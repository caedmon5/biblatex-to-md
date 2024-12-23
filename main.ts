import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from "obsidian";
import * as bibtexParser from "@retorquere/bibtex-parser";

// ====================== //
// Plugin Settings Object //
// ====================== //
interface BibLaTeXPluginSettings {
  templatePath: string;
  entryLimit: number;
}

// ========================== //
// Default Settings           //
// ========================== //
const DEFAULT_SETTINGS: BibLaTeXPluginSettings = {
  templatePath: "templates/biblatex_template.md",
  entryLimit: 5,
};

// ========================== //
// Main Plugin Class          //
// ========================== //
export default class BibLaTeXPlugin extends Plugin {
  settings: BibLaTeXPluginSettings;

  async onload() {
    console.log("Loading BibLaTeX to Markdown Plugin...");

    // Load settings
    await this.loadSettings();

    // Register command to import BibTeX files
    this.addCommand({
      id: "import-bibtex",
      name: "Import BibTeX File",
      callback: () => this.importBibTeX(),
    });

    // Add settings tab
    this.addSettingTab(new BibLaTeXSettingTab(this.app, this));
  }

  // =========================== //
  // Function: Import BibTeX File //
  // =========================== //
  async importBibTeX() {
    const files = this.app.vault.getFiles().filter((file) => file.extension === "bib");

    if (files.length === 0) {
      new Notice("No BibTeX files found in your vault.");
      return;
    }

    for (const file of files.slice(0, this.settings.entryLimit)) {
      const content = await this.app.vault.read(file);
      const parsedData = bibtexParser.parse(content);

      for (const entry of parsedData.entries) {
        const markdown = this.generateMarkdownFromEntry(entry);
        const fileName = this.generateFileName(entry);

        await this.saveMarkdownFile(fileName, markdown);
      }
    }

    new Notice("BibTeX entries imported successfully!");
  }

  // =============================== //
  // Function: Generate Markdown     //
  // =============================== //
  generateMarkdownFromEntry(entry: any): string {
    const fields = entry.fields || {};
    const escapeYAML = (str: string) => str.replace(/"/g, `\\"`).replace(/{|}/g, "");

    // Type Mapping
    const typeMap: Record<string, string> = {
      article: "Journal Article",
      book: "Book",
      inbook: "Book Section",
      report: "Report",
      thesis: "Thesis",
      newspaper: "Newspaper Article",
      online: "Webpage",
      misc: "Miscellaneous",
      patent: "Patent",
      podcast: "Podcast",
      presentation: "Presentation",
      film: "Film",
      software: "Software",
      map: "Map",
    };

    const type = typeMap[fields.entrysubtype || fields.type || "misc"] || "Miscellaneous";
    const title = fields.title ? escapeYAML(fields.title) : "Untitled";
    const authors = this.extractAuthorTags(fields.author) || "#Unknown_Author";
    const year = fields.date?.split("-")[0] || fields.year || "Unknown Year";
    const abstract = fields.abstract ? escapeYAML(fields.abstract) : "No abstract provided.";
    const zoteroLink = fields.url || "No link provided.";

    // Keywords
    let keywords = "None";
    let formattedKeywords = "";
    if (typeof fields.keywords === "string" && fields.keywords.trim().length > 0) {
      const keywordArray = fields.keywords.split(",").map((k: string) => k.trim());
      keywords = keywordArray.join(", ");
      formattedKeywords = keywordArray
        .map((k: string) => `#${k.replace(/ /g, "_")}`)
        .join(" ");
    }

    // Replacements
    const replacements: Record<string, string> = {
      citekey: entry.key || "Unknown",
      type,
      title,
      authors,
      year: year.toString(),
      createdDate: new Date().toISOString().split("T")[0],
      lastModified: fields["date-modified"] || "Unknown",
      abstract,
      keywords,
      formattedKeywords,
      tags: `${authors} ${formattedKeywords}`,
      zoteroLink,
    };

    const templateContent = `---
citekey: "{{citekey}}"
type: "{{type}}"
authors: "{{authors}}"
createdDate: "{{createdDate}}"
lastModified: "{{lastModified}}"
tags: "{{tags}}"
title: "{{title}}"
year: "{{year}}"
keywords: "{{keywords}}"
zoteroLink: "{{zoteroLink}}"
---

# {{title}}

**Type**: {{type}}  
**Authors**: {{authors}}  
**Year**: {{year}}  

**Keywords**: {{formattedKeywords}}

**Abstract**:  
{{abstract}}

**Zotero Link**: [View in Zotero]({{zoteroLink}})
`;

    return templateContent.replace(/{{(.*?)}}/g, (_, key) => replacements[key.trim()] || `{{${key}}}`);
  }

  // =============================== //
  // Function: Generate File Name    //
  // =============================== //
generateFileName(entry: any): string {
  const sanitize = (str: string) =>
    str.replace(/[\\/:*?"<>|]/g, "_"); // Replace invalid characters with underscores

  const authors = this.extractAuthorTags(entry.fields.author)
    .replace(/#/g, "")
    .split(" ")[0];
  const sanitizedAuthors = sanitize(authors || "Unknown_Author");

  const year = entry.fields.year || "UnknownYear";

  const title = entry.fields.title
    ? sanitize(entry.fields.title.split(" ").slice(0, 5).join("_"))
    : "Untitled";

  return `LN_${sanitizedAuthors}_${year}_${title}.md`;
}

  // =============================== //
  // Function: Save Markdown File    //
  // =============================== //
  async saveMarkdownFile(fileName: string, content: string) {
    const targetPath = `LN Literature Notes/${fileName}`;
    await this.app.vault.create(targetPath, content);
    console.log(`File saved: ${targetPath}`);
  }

  // ============================ //
  // Function: Extract Author Tags //
  // ============================ //


extractAuthorTags(authors: any): string {
  const sanitize = (str: string) =>
    str.replace(/ /g, "_").replace(/[{}]/g, "");

  // If authors is undefined or null
  if (!authors) {
    return "#Unknown_Author";
  }

  // If authors is a string
  if (typeof authors === "string") {
    return authors
      .replace(/[{}]/g, "")
      .split(" and ")
      .map((name) => `#${sanitize(name.split(",")[0]?.trim() || "Unknown_Author")}`)
      .join(" ");
  }

  // If authors is an array
  if (Array.isArray(authors)) {
    return authors
      .map((author: any) => {
        if (typeof author === "string") {
          return `#${sanitize(author.split(",")[0]?.trim() || "Unknown_Author")}`;
        } else if (author.literal) {
          return `#${sanitize(author.literal)}`;
        } else {
          return "#Unknown_Author";
        }
      })
      .join(" ");
  }

  // Default fallback for unsupported types
  return "#Unknown_Author";
}

  // ========================== //
  // Load and Save Settings     //
  // ========================== //
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

// ============================= //
// Settings Tab                  //
// ============================= //
class BibLaTeXSettingTab extends PluginSettingTab {
  plugin: BibLaTeXPlugin;

  constructor(app: App, plugin: BibLaTeXPlugin) {
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
