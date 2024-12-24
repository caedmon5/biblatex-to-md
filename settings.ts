import { PluginSettingTab, Setting, App } from "obsidian";

// Define plugin settings and their defaults
export interface BibLaTeXPluginSettings {
  templatePath: string;
  entryLimit: number; // New setting
}

export const DEFAULT_SETTINGS: BibLaTeXPluginSettings = {
  templatePath: "templates/bibtex-template.md",
  entryLimit: 5, // Default is 5
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

    // Add entry limit setting (text input instead of slider)
    new Setting(containerEl)
      .setName("Entry Limit")
      .setDesc("Maximum number of entries to process from each BibTeX file (1 or more).")
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
  }
}
