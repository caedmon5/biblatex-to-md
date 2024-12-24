import { Plugin, Notice, PluginSettingTab, Setting } from "obsidian";
const BibtexParser = require("@retorquere/bibtex-parser");

// Define default settings
interface BibLaTeXPluginSettings {
  templatePath: string;
}

const DEFAULT_SETTINGS: BibLaTeXPluginSettings = {
  templatePath: "templates/bibtex-template.md", // Default template path
};

export default class BibLaTeXPlugin extends Plugin {
  settings: BibLaTeXPluginSettings;

  async onload() {
    console.log("BibLaTeX Plugin loaded.");

    // Load settings
    await this.loadSettings();

    // Add settings tab
    this.addSettingTab(new BibLaTeXPluginSettingTab(this.app, this));

    // Add command for importing BibTeX files
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

    // Get core template folder if available
    const coreTemplatesSettings = (this.app as any).internalPlugins.plugins["templates"]?.instance?.options;
    const coreTemplateFolder = coreTemplatesSettings?.folder;

    // Fallback to plugin settings template path
    const templatePath = coreTemplateFolder
      ? `${coreTemplateFolder}/bibtex-template.md`
      : this.settings.templatePath;

    const templateFile = this.app.vault.getAbstractFileByPath(templatePath);
    if (!templateFile) {
      new Notice(`Template file not found: ${templatePath}`);
      console.error(`Template file not found: ${templatePath}`);
      return;
    }

    const templateContent = await this.app.vault.read(templateFile);

    for (const file of files) {
      try {
        const content = await this.app.vault.read(file);
        console.log(`Processing file: ${file.path}`);
        console.log("File content:", content);

        const parsedResult = BibtexParser.parse(content);
        const parsedEntries = parsedResult.entries;
        console.log("Parsed entries:", parsedEntries);

        for (const entry of parsedEntries) {
          console.log("Parsed entry:", entry);

          const fields = entry.fields || {};
          const title = fields.title || "Untitled";

          let authors = fields.author || "Unknown Author";

          // Ensure authors is always a string
          if (typeof authors === "string") {
            const authorParts = authors.replace(/[{}]/g, "").split(",");
            authors = authorParts[0]?.trim() || "Unknown Author";
          } else if (Array.isArray(authors)) {
            authors = authors.map((a) => a.lastName || "Unknown").join(", ");
          } else if (typeof authors === "object" && authors.lastName) {
            authors = authors.lastName;
          } else {
            authors = String(authors); // Fallback to ensure it's a string
          }

          const year = fields.date?.split("-")[0] || fields.year || "Unknown Year";
          const abstract = fields.abstract || "No abstract provided.";
          const journaltitle = fields.journaltitle || "Unknown Journal";
          const keywords = fields.keywords || "None";

          // Replace placeholders in the template
          const populatedContent = templateContent.replace(/{{(.*?)}}/g, (_, key) => {
const replacements: Record<string, string> = {
  type: entry.type || "Unknown Type",
  authors,
  title,
  year,
  abstract,
  journaltitle,
  keywords,
  publisher: fields.publisher || "Unknown Publisher",
  volume: fields.volume || "N/A",
  issue: fields.issue || "N/A",
  pages: fields.pages || "N/A",
  doi: fields.doi || "N/A",
  url: fields.url || "No URL provided"
};

            const value = replacements[key.trim()];
            if (value === undefined) {
              console.warn(`Warning: No replacement found for placeholder "{{${key}}}".`);
              return `{{${key}}}`; // Keep the placeholder if no match
            }
            return value;
          });

          const folderPath = "LN Literature Notes";
          if (!this.app.vault.getAbstractFileByPath(folderPath)) {
            await this.app.vault.createFolder(folderPath);
          }

          const sanitizedTitle = title.replace(/[\/\\:*?"<>|]/g, "_").slice(0, 50);
          const sanitizedAuthors = authors.replace(/[\/\\:*?"<>|]/g, "_");
          const fileName = `LN ${sanitizedAuthors} ${year} ${sanitizedTitle}.md`;

          await this.app.vault.create(`${folderPath}/${fileName}`, populatedContent);
          console.log(`Created Markdown file: ${folderPath}/${fileName}`);
        }
      } catch (error) {
        console.error(`Error processing file ${file.path}:`, error);
      }
    }

    new Notice("BibTeX entries imported successfully!");
  }

  onunload() {
    console.log("BibLaTeX Plugin unloaded.");
  }
}

// Add a settings tab
class BibLaTeXPluginSettingTab extends PluginSettingTab {
  plugin: BibLaTeXPlugin;

  constructor(app: App, plugin: BibLaTeXPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "BibLaTeX Plugin Settings" });

    new Setting(containerEl)
      .setName("Template Path")
      .setDesc("Path to the template file used for generating Markdown notes.")
      .addText((text) =>
        text
          .setPlaceholder("templates/bibtex-template.md")
          .setValue(this.plugin.settings.templatePath)
          .onChange(async (value) => {
            this.plugin.settings.templatePath = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
