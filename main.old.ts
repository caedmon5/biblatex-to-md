import { Plugin, Notice, PluginSettingTab, Setting } from "obsidian";
const BibtexParser = require("@retorquere/bibtex-parser");

// Define settings interface and default values
interface BibLaTeXPluginSettings {
  templatePath: string; // Path to the Markdown template file
  combineEntries: boolean; // Whether to combine all entries into one file
  maxEntries: number; // Maximum number of entries to process
}

const DEFAULT_SETTINGS: BibLaTeXPluginSettings = {
  templatePath: "templates/bibtex-template.md",
  combineEntries: false,
  maxEntries: 5,
};

export default class BibLaTeXPlugin extends Plugin {
  settings: BibLaTeXPluginSettings;

  async onload() {
    console.log("BibLaTeX Plugin loaded.");

    await this.loadSettings();
    this.addSettingTab(new BibLaTeXPluginSettingTab(this.app, this));

    this.addCommand({
      id: "import-bibtex",
      name: "Import BibTeX",
      callback: async () => {
        console.log("Import BibTeX command executed.");
        await this.importBibTeX();
      },
    });
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async importBibTeX() {
    const files = this.app.vault.getFiles().filter((file) => file.extension === "bib");
    console.log("Found .bib files:", files.map((file) => file.path));

    if (files.length === 0) {
      new Notice("No BibTeX files found in your vault.");
      return;
    }

    const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templatePath);
    if (!templateFile) {
      new Notice(`Template file not found: ${this.settings.templatePath}`);
      return;
    }
    const templateContent = await this.app.vault.read(templateFile);

    for (const file of files) {
      try {
        const content = await this.app.vault.read(file);
        const parsedResult = BibtexParser.parse(content);
        const parsedEntries = parsedResult.entries.slice(0, this.settings.maxEntries);

        if (this.settings.combineEntries) {
          const combinedContent = parsedEntries
            .map((entry) => this.generateMarkdownFromEntry(entry, templateContent))
            .join("\n\n---\n\n");

          const fileName = `LN Combined Entries ${new Date().toISOString().split("T")[0]}.md`;
          await this.app.vault.create(`LN Literature Notes/${fileName}`, combinedContent);
        } else {
          for (const entry of parsedEntries) {
            const content = this.generateMarkdownFromEntry(entry, templateContent);
            const sanitizedTitle = (entry.fields?.title || "Untitled").replace(/[\/\\:*?"<>|]/g, "_").slice(0, 50);

            let rawAuthors = entry.fields?.author || "Unknown Author";
            if (typeof rawAuthors === "string") {
              rawAuthors = rawAuthors.replace(/[{}]/g, "").split(",")[0]?.trim() || "Unknown Author";
            } else if (Array.isArray(rawAuthors)) {
              rawAuthors = rawAuthors.map((a) => (typeof a === "string" ? a : a.lastName || "Unknown")).join(", ");
            } else if (typeof rawAuthors === "object" && rawAuthors.lastName) {
              rawAuthors = rawAuthors.lastName;
            } else {
              rawAuthors = "Unknown Author";
            }

            const sanitizedAuthors = rawAuthors.replace(/[\/\\:*?"<>|]/g, "_");
            const year = entry.fields?.date?.split("-")[0] || entry.fields?.year || "Unknown Year";
            const fileName = `LN ${sanitizedAuthors} ${year} ${sanitizedTitle}.md`;

            await this.app.vault.create(`LN Literature Notes/${fileName}`, content);
          }
        }
      } catch (error) {
        console.error(`Error processing file ${file.path}:`, error);
      }
    }
    new Notice("BibTeX entries imported successfully!");
  }

generateMarkdownFromEntry(entry: any, templateContent: string): string {
  const fields = entry.fields || {};
  const escapeYAML = (str: string) => str.replace(/"/g, `\\"`); // Escape quotes

  const title = fields.title
    ? `"${escapeYAML(fields.title)}"`
    : '"Untitled"';
  const abstract = fields.abstract
    ? `"${escapeYAML(fields.abstract)}"`
    : '"No abstract provided."';
  const year = fields.date?.split("-")[0] || fields.year || "Unknown Year";
  const journaltitle = fields.journaltitle
    ? `"${escapeYAML(fields.journaltitle)}"`
    : '"Unknown Journal"';
  const keywords = fields.keywords
    ? `"${escapeYAML(fields.keywords)}"`
    : '"None"';

  let authors = fields.author || "Unknown Author";

  // Normalize authors to a string and escape it for YAML
  if (typeof authors === "string") {
    authors = `"${escapeYAML(authors.replace(/[{}]/g, "").split(",")[0]?.trim() || "Unknown Author")}"`;
  } else if (Array.isArray(authors)) {
    authors = authors
      .map((a) => (typeof a === "string" ? escapeYAML(a) : a.lastName || "Unknown"))
      .join(", ");
    authors = `"${authors}"`;
  } else if (typeof authors === "object" && authors.lastName) {
    authors = `"${escapeYAML(authors.lastName)}"`;
  } else {
    authors = '"Unknown Author"';
  }

  // Replace placeholders in the template
  return templateContent.replace(/{{(.*?)}}/g, (_, key) => {
    const replacements: Record<string, string> = {
      type: `"${entry.type || "Unknown Type"}"`,
      authors,
      title,
      year: year.toString(),
      abstract,
      journaltitle,
      keywords,
    };

    const value = replacements[key.trim()];
    if (value === undefined) {
      console.warn(`Warning: No replacement found for placeholder "{{${key}}}".`);
      return `{{${key}}}`; // Keep the placeholder if no match
    }
    return value;
  });
}

}

class BibLaTeXPluginSettingTab extends PluginSettingTab {
  plugin: BibLaTeXPlugin;

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Template Path")
      .setDesc("Path to the template file.")
      .addText((text) =>
        text
          .setValue(this.plugin.settings.templatePath)
          .onChange(async (value) => {
            this.plugin.settings.templatePath = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Combine Entries")
      .setDesc("Combine all entries into a single file.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.combineEntries).onChange(async (value) => {
          this.plugin.settings.combineEntries = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Maximum Entries")
      .setDesc("Maximum entries to process.")
      .addText((text) =>
        text.setValue(this.plugin.settings.maxEntries.toString()).onChange(async (value) => {
          const num = parseInt(value, 10);
          if (!isNaN(num) && num > 0) {
            this.plugin.settings.maxEntries = num;
            await this.plugin.saveSettings();
          }
        })
      );
  }
}
