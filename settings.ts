import { PluginSettingTab, Setting, App } from "obsidian";

// Define plugin settings and their defaults
export interface BibLaTeXPluginSettings {
  templatePath: string; // defines the path for the template
  entryLimit: number; // limits the number of entries to be processed
 filePrefix: string;      // New: Specifies the prefix for file names
    fileDirectory: string;   // New: Specifies the directory for file creation
templateDirectory: string;  // Directory containing templates
templateFileName: string;   // Specific template file

}

export const DEFAULT_SETTINGS: BibLaTeXPluginSettings = {
  templatePath: "/", // default is to the root directory
  entryLimit: 5, // Default is 5
    filePrefix: "",     // Default to no prefix
    fileDirectory: "/", // Default to the root directory
    templateDirectory: "/", // default to obsidian root directory
    templateFileName: "", // default is no template filename
};

// Create a settings tab for user configuration
export class BibLaTeXPluginSettingTab extends PluginSettingTab {
  plugin: any; // Ideally, replace 'any' with the specific plugin type (BibLaTeXPlugin)

  constructor(app: App, plugin: any) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Display settings in the Obsidian settings panel
  display(): void {
    const { containerEl } = this;

    // Clear previous content in the settings panel
    containerEl.empty();

    // Create header for settings
    containerEl.createEl("h2", { text: "Settings for BibLaTeX Plugin" });

    // Add setting for template path
new Setting(containerEl)
    .setName("Template Directory")
    .setDesc("Specify the directory containing your templates.")
    .addDropdown((dropdown) => {
        const vaultPath = this.app.vault.adapter.basePath; // Get the vault root
        const folders = this.app.vault.getAllLoadedFiles()
            .filter((f) => f.children) // Only directories
            .map((folder) => folder.path);

        dropdown.addOption("/", "Vault Root");
        folders.forEach((folder) => dropdown.addOption(folder, folder));

        dropdown.setValue(this.plugin.settings.templateDirectory);
        dropdown.onChange(async (value) => {
            this.plugin.settings.templateDirectory = value;
            await this.plugin.saveSettings();
        });
    });

new Setting(containerEl)
    .setName("Template File")
    .setDesc("Select a specific template file.")
    .addDropdown((dropdown) => {
        const vaultPath = this.app.vault.adapter.basePath; // Get the vault root
        const templateDir = path.join(vaultPath, this.plugin.settings.templateDirectory);
        const files = this.app.vault.getAllLoadedFiles()
            .filter((f) => f.path.startsWith(templateDir) && !f.children) // Only files in the template directory
            .map((file) => file.path);

        dropdown.addOption("", "None"); // Default option
        files.forEach((file) => dropdown.addOption(file, file));

        dropdown.setValue(this.plugin.settings.templateFileName);
        dropdown.onChange(async (value) => {
            this.plugin.settings.templateFileName = value;
            await this.plugin.saveSettings();
        });
    });

    // Add entry limit setting (text input instead of slider)
    new Setting(containerEl)
      .setName("Entry Limit")
      .setDesc("Specify the maximum number of entries to process from each BibTeX file (1 or more). Default is 5.")
      .addText((text) =>
        text
          .setPlaceholder("e.g., 5 or 10000")
          .setValue(String(this.plugin.settings.entryLimit))
          .onChange(async (value) => {
            console.log("Entry Limit (raw):", value);
            const parsedValue = parseInt(value, 10);
            if (!isNaN(parsedValue) && parsedValue > 0) {
              this.plugin.settings.entryLimit = parsedValue;
              await this.plugin.saveSettings();
            }
          })
      );

// Add entry for output file prefix (default = none)
new Setting(containerEl)
    .setName("File Prefix")
    .setDesc("Specify a prefix for file names (default = none).")
    .addText((text) =>
        text
            .setPlaceholder("e.g., Notes_")
            .setValue(this.plugin.settings.filePrefix)
            .onChange(async (value) => {
                this.plugin.settings.filePrefix = value;
                await this.plugin.saveSettings();
            })
    );


// Add entry for output file location (default = current)
new Setting(containerEl)
    .setName("File Directory")
    .setDesc("Specify the directory for file creation (default is current).")
.addDropdown((dropdown) => {
        // Populate dropdown with existing subdirectories
        const vaultPath = this.app.vault.adapter.basePath; // Get vault root
        const folders = this.app.vault.getAllLoadedFiles()
            .filter((f) => f.children) // Only directories
            .map((folder) => folder.path);

        dropdown.addOption("/", "Vault Root"); // Add default option
        folders.forEach((folder) => dropdown.addOption(folder, folder));

        dropdown.setValue(this.plugin.settings.fileDirectory);
        dropdown.onChange(async (value) => {
            this.plugin.settings.fileDirectory = value;
            await this.plugin.saveSettings();
        });
    });

  }
}
