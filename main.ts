// Import necessary Obsidian classes and external modules
import { Plugin, Notice } from "obsidian";
const BibtexParser = require("@retorquere/bibtex-parser");

// Import settings from our new file
import {
  BibLaTeXPluginSettings,
  DEFAULT_SETTINGS,
  BibLaTeXPluginSettingTab,
} from "./settings";

// Main plugin class
export default class BibLaTeXPlugin extends Plugin {
  settings: BibLaTeXPluginSettings;

  // Plugin initialization and setup
  async onload() {
    console.log("BibLaTeX Plugin loaded.");

    // Load settings
    await this.loadSettings();

    // Create a settings tab for user configuration
    this.addSettingTab(new BibLaTeXPluginSettingTab(this.app, this));

    // Register plugin commands
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
    // Load plugin settings from Obsidian storage
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    // Save plugin settings to Obsidian storage
    await this.saveData(this.settings);
  }

async importBibTeX() {
  const files = this.app.vault.getFiles().filter((file) => file.extension === "bib");
  console.log("Found .bib files:", files.map((file) => file.path));

  if (files.length === 0) {
    new Notice("No BibTeX files found in your vault.");
    return;
  }

  const coreTemplatesSettings = (this.app as any).internalPlugins.plugins["templates"]?.instance?.options;
  const coreTemplateFolder = coreTemplatesSettings?.folder;
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

      // Only process up to the 'entryLimit' from each file
      for (const entry of parsedEntries.slice(0, this.settings.entryLimit)) {
        console.log("Parsed entry:", entry);

        const fields = entry.fields || {};
        const title = fields.title || "Untitled";

        // --- 1) Get a more complete author string ---
        let authorsRaw = fields.author || "Unknown Author";
        let authorsFinal = "";

        if (typeof authorsRaw === "string") {
          // If it's a single string with commas, try to reorder "Last, First" → "First Last"
          // Or you can simply keep it as-is if you prefer
          const cleaned = authorsRaw.replace(/[{}]/g, "");
          // Some BibTeX items use "and" to separate multiple authors
          const authorSplits = cleaned.split(/\s+and\s+/i);

          // For each "Last, First" -> "First Last"
          const processed = authorSplits.map((authorStr) => {
            const [lastName, firstName] = authorStr.split(",");
            if (firstName && lastName) {
              return `${firstName.trim()} ${lastName.trim()}`;
            }
            return authorStr.trim();
          });

          authorsFinal = processed.join(", ");
        } else if (Array.isArray(authorsRaw)) {
          // If it's an array of objects from the parser
          // e.g. [{ firstName: "John", lastName: "Smith" }, ...]
          authorsFinal = authorsRaw
            .map((a) => {
              const fn = a.firstName || "";
              const ln = a.lastName || "";
              return fn && ln ? `${fn} ${ln}` : (ln || fn || "Unknown");
            })
            .join(", ");
        } else if (typeof authorsRaw === "object") {
          // If there's a single object
          const fn = authorsRaw.firstName || "";
          const ln = authorsRaw.lastName || "";
          authorsFinal = fn && ln ? `${fn} ${ln}` : (ln || fn || "Unknown");
        } else {
          authorsFinal = String(authorsRaw); 
        }

        // --- 2) Derive other fields ---
        const year = fields.date?.split("-")[0] || fields.year || "Unknown Year";
        const abstract = fields.abstract || "No abstract provided.";
        const journaltitle = fields.journaltitle || "Unknown Journal";
        const keywords = fields.keywords || "None";

        // 2a) Format the keywords with # 
        let formattedKeywords = "";
        if (typeof keywords === "string" && keywords.trim()) {
          const keywordArray = keywords.split(",").map((k: string) => k.trim());
          formattedKeywords = keywordArray
            .map((k: string) => `#${k.replace(/\s+/g, "_")}`)
            .join(" ");
        }

        // 2b) Build some tags from authors + keywords (adjust as desired)
        let tags = `${authorsFinal} ${formattedKeywords}`.trim();

        // 2c) A “createdDate” and “lastModified”
        // If you don’t store a “date-modified” in fields, you can default to today or “Unknown”
        const createdDate = new Date().toISOString().split("T")[0];
        const lastModified = fields["date-modified"] || createdDate;

        // 2d) A citekey if you want to store it
        const citekey = entry.key || "UnknownKey";

        // 2e) If you have a Zotero link, or just store the 'url' from the fields
        const zoteroLink = fields.url || "No link provided";

        // 2f) If you want “conditionalFields” for something dynamic, or just leave it empty
        let conditionalFields = ""; 
        // If you want logic, you can do:
        // if (something) { conditionalFields = "Special info here"; }

        // --- 3) Replacements object includes all placeholders from your template ---
        const replacements: Record<string, string> = {
          citekey,
          createdDate,
          lastModified,
          tags,
          formattedKeywords,
          zoteroLink,
          conditionalFields,

          type: entry.type || "Unknown Type",
          authors: authorsFinal,
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

        // --- 4) Replace placeholders in the template
        const populatedContent = templateContent.replace(/{{(.*?)}}/g, (_, key) => {
          const value = replacements[key.trim()];
          if (value === undefined) {
            console.warn(`Warning: No replacement found for placeholder "{{${key}}}".`);
            return `{{${key}}}`;
          }
          return value;
        });

        // --- 5) Write file
        const folderPath = "LN Literature Notes";
        if (!this.app.vault.getAbstractFileByPath(folderPath)) {
          await this.app.vault.createFolder(folderPath);
        }

        const sanitizedTitle = title.replace(/[\/\\:*?"<>|]/g, "_").slice(0, 50);
        const sanitizedAuthors = authorsFinal.replace(/[\/\\:*?"<>|]/g, "_");
        const fileName = `LNL ${sanitizedAuthors} ${year} ${sanitizedTitle}.md`;

        await this.app.vault.create(`${folderPath}/${fileName}`, populatedContent);
        console.log(`Created Markdown file: ${folderPath}/${fileName}`);
      }
    } catch (error) {
      console.error(`Error processing file ${file.path}:`, error);
    }
  }

  new Notice("BibTeX entries imported successfully!");
}

  // Plugin cleanup (optional, for when the plugin is disabled)
  onunload() {
    console.log("BibLaTeX Plugin unloaded.");
  }
}
