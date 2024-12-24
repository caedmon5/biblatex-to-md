import { PluginSettingTab, Setting, App } from "obsidian";

// Define plugin settings and their defaults
export interface BibLaTeXPluginSettings {
  templatePath: string;
  // Optional: If you plan to use debugMode, uncomment/add the following:
//   debugMode: boolean;
}

export const DEFAULT_SETTINGS: BibLaTeXPluginSettings = {
  templatePath: "templates/bibtex-template.md",
  // Optional: If you plan to use debugMode:
//   debugMode: false,
};

// Create a settings tab for user configuration
export class BibLaTeXPluginSettingTab extends PluginSettingTab {
  plugin: any; // If you'd like, replace 'any' with the specific plugin type

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
      .setDesc("Path to the template file for Markdown notes.")
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

    // Optional: If you want a debugMode setting
    // new Setting(containerEl)
    //   .setName("Debug Mode")
    //   .setDesc("Enable debug logging in the console.")
    //   .addToggle((toggle) => {
    //     toggle
    //       .setValue(this.plugin.settings.debugMode)
    //       .onChange(async (value) => {
    //         this.plugin.settings.debugMode = value;
    //         await this.plugin.saveSettings();
    //       });
    //   });
  }
}
