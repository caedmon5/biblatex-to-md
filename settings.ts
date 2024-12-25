import { PluginSettingTab, Setting, App } from "obsidian";

// Define plugin settings and their defaults
export interface BibLaTeXPluginSettings {
  templatePath: string; // defines the path for the template
  entryLimit: number; // limits the number of entries to be processed
 filePrefix: string;      // New: Specifies the prefix for file names
    fileDirectory: string;   // New: Specifies the directory for file creation
}

export const DEFAULT_SETTINGS: BibLaTeXPluginSettings = {
  templatePath: "templates/bibtex-template.md",
  entryLimit: 5, // Default is 5
    filePrefix: "",     // Default to no prefix
    fileDirectory: "./", // Default to current directory
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
      .setName("Template Path")
      .setDesc("Specify the path to the template file for use with this plugin.")
      .addText((text) =>
        text
          .setPlaceholder("Enter template path")
          .setValue(this.plugin.settings.templatePath)
          .onChange(async (value) => {
            console.log("Template Path: " + value);
            this.plugin.settings.templatePath = value;
            await this.plugin.saveSettings();
          })
      );

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
    .addText((text) =>
        text
            .setPlaceholder("e.g., /my/notes")
            .setValue(this.plugin.settings.fileDirectory)
            .onChange(async (value) => {
                this.plugin.settings.fileDirectory = value;
                await this.plugin.saveSettings();
            })
    );

  }
}
