import { App, PluginSettingTab, Setting } from "obsidian";

// ====================== //
// Plugin Settings Object //
// ====================== //
export interface BibLaTeXPluginSettings {
  templatePath: string;
  entryLimit: number;
}

// ========================== //
// Default Settings           //
// ========================== //
export const DEFAULT_SETTINGS: BibLaTeXPluginSettings = {
  templatePath: "templates/biblatex_template.md",
  entryLimit: 5,
};

// ============================= //
// Settings Tab                  //
// ============================= //
export class BibLaTeXSettingTab extends PluginSettingTab {
  plugin: any; // Or better: plugin: BibLaTeXPlugin if you wish

  constructor(app: App, plugin: any) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "BibLaTeX to Markdown Settings" });

    new Setting(containerEl)
      .setName("Template Path")
      .setDesc("Path to your Obsidian template file")
      .addText((text) =>
        text
          .setPlaceholder("templates/biblatex_template.md")
          .setValue(this.plugin.settings.templatePath)
          .onChange(async (value) => {
            this.plugin.settings.templatePath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Entry Limit")
      .setDesc("Maximum number of BibTeX entries to process at once")
      .addSlider((slider) =>
        slider
          .setLimits(1, 100, 1)
          .setValue(this.plugin.settings.entryLimit)
          .onChange(async (value) => {
            this.plugin.settings.entryLimit = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
