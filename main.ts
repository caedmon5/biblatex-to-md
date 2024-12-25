// Import necessary Obsidian classes and external modules
import * as path from "path";
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

/**
 * Helper function to sanitize strings
 * Removes invalid characters for filenames or other uses.
 * @param {string} input - The string to sanitize.
 * @returns {string} Sanitized string.
 */
sanitizeString(input: string): string {
    return input.replace(/[\/\\:*?"<>|]/g, "_").trim();
}



/**
 * Helper function to process author names
 * @param {Array|Object|string} authorsRaw - Raw authors data
 * @returns {Object} Object with formatted tags and filenames
 */
processAuthors(authorsRaw) {
    if (!authorsRaw || authorsRaw === "Unknown Author") {
        return {
            authorTags: ["#UnknownAuthor"],
            fileNameAuthor: "UnknownAuthor"
        };
    }

    let authorTags = [];
    let fileNameAuthor = "";

    if (typeof authorsRaw === "string") {
        const cleaned = authorsRaw.replace(/[{}]/g, "");
        const authorSplits = cleaned.split(/\s+and\s+/i);  // Splits multiple authors
        authorSplits.forEach((authorStr) => {
            const lastNameOnly = authorStr.trim().split(",")[0].trim();
            authorTags.push(`#${lastNameOnly}`);
        });
        fileNameAuthor = authorSplits.length > 1
            ? `${authorTags[0].replace(/^#/, "")}_et_al`
            : authorTags[0].replace(/^#/, "");
    } else if (Array.isArray(authorsRaw)) {
        authorsRaw.forEach((a) => {
            const last = a.lastName || "Unknown";
            authorTags.push(`#${last}`);
        });
        fileNameAuthor = authorTags.length > 1
            ? `${authorTags[0].replace(/^#/, "")}_et_al`
            : authorTags[0].replace(/^#/, "");
    }

    return { authorTags, fileNameAuthor };
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

      // Process up to 'entryLimit' from each file
      for (const entry of parsedEntries.slice(0, this.settings.entryLimit)) {
        console.log("Parsed entry:", entry);

        const fields = entry.fields || {};
        const title = fields.title || "Untitled";

        //---------------------------------------------------
        // (1) AUTHOR TAGS => build an array like ["#FryeN", "#SmithJ"]
        //---------------------------------------------------
const authorsRaw = fields.author || "Unknown Author";
const { authorTags, fileNameAuthor } = this.processAuthors(authorsRaw);

        if (typeof authorsRaw === "string") {
          // Remove braces; split on " and "
          const cleaned = authorsRaw.replace(/[{}]/g, "");
          const authorSplits = cleaned.split(/\s+and\s+/i);

          authorSplits.forEach((authorStr) => {
const tag = this.buildAuthorTag(this.sanitizeString(authorStr.trim()));
            authorTags.push(`#${tag}`);
          });
        } else if (Array.isArray(authorsRaw)) {
          // e.g. [{ firstName: 'Northrup', lastName: 'Frye' }, ...]
          authorsRaw.forEach((a) => {
            const first = a.firstName || "";
            const last = a.lastName || "";
            const combined = `${first} ${last}`.trim();
            const tag = this.buildAuthorTag(combined);
            authorTags.push(`#${tag}`);
          });
        } else if (typeof authorsRaw === "object") {
          // Single object
          const first = authorsRaw.firstName || "";
          const last = authorsRaw.lastName || "";
          const combined = `${first} ${last}`.trim();
          authorTags.push(`#${this.buildAuthorTag(combined)}`);
        } else {
          // Fallback
          authorTags.push("#UnknownAuthor");
        }

        // We'll store them as a single-line YAML array: ["#FryeN","#SmithJ"]
        const authorsInlineArray = `["${authorTags.join('","')}"]`;

        //---------------------------------------------------
        // (2) KEYWORD TAGS => build an array like ["#Anglo_Saxon", "#Old_English"]
        //---------------------------------------------------
        let keywordArray: string[] = [];
        if (typeof fields.keywords === "string" && fields.keywords.trim()) {
          // Remove any braces just in case
          const cleaned = fields.keywords.replace(/[{}]/g, "").trim();
          if (cleaned) {
            // Split on commas
            const splitted = cleaned.split(",").map((k) => k.trim());
            keywordArray = splitted.map((kw) => `#${kw.replace(/\s+/g, "_")}`);
          }
        } else if (Array.isArray(fields.keywords)) {
          // If the parser returns an array
keywordArray = fields.keywords.map((kw: string) => `#${this.sanitizeString(String(kw))}`);
        }
        const keywordsInlineArray = `["${keywordArray.join('","')}"]`;

        //---------------------------------------------------
        // (3) Other fields
        //---------------------------------------------------
        const year = fields.date?.split("-")[0] || fields.year || "Unknown Year";
        const abstract = fields.abstract || "No abstract provided.";
        const journaltitle = fields.journaltitle || "Unknown Journal";
        const citekey = entry.key || "UnknownKey";
        const createdDate = new Date().toISOString().split("T")[0];
        const lastModified = fields["date-modified"] || createdDate;
        const url = fields.url || "No link provided";

        // Build the replacements object
        const replacements: Record<string, string> = {
          citekey,
          createdDate,
          lastModified,
          title,
          year,
          abstract,
          journaltitle,
          type: entry.type || "Unknown Type",
          publisher: fields.publisher || "Unknown Publisher",
          volume: fields.volume || "N/A",
          issue: fields.issue || "N/A",
          pages: fields.pages || "N/A",
          doi: fields.doi || "N/A",
          url,
          zoteroLink: url,
          conditionalFields: "",

          // Insert the inline YAML arrays
          authors: authorsInlineArray,   // for {{authors}} in the template
          keywords: keywordsInlineArray, // for {{keywords}} in the template
        };

        // Replace placeholders in the template
        const populatedContent = templateContent.replace(/{{(.*?)}}/g, (_, key) => {
          const val = replacements[key.trim()];
          if (val === undefined) {
            console.warn(`Warning: No replacement found for placeholder "{{${key}}}".`);
            return `{{${key}}}`;
          }
          return val;
        });

        //---------------------------------------------------
        // (4) Write the file
        //---------------------------------------------------
        const folderPath = "LN Literature Notes";
        if (!this.app.vault.getAbstractFileByPath(folderPath)) {
          await this.app.vault.createFolder(folderPath);
        }

        // Use first author tag (minus '#') in the file name

// Sanitize and truncate title after the fourth word
const truncatedTitle = this.sanitizeString(
    title.split(/\s+/).slice(0, 4).join(" ")
);

// Add prefix if defined
const filePrefix = this.settings.filePrefix ? `${this.settings.filePrefix} ` : "";

// Get the Obsidian vault path
const vaultPath = this.app.vault.adapter.basePath; // Get the Obsidian root directory

// Resolve the template directory
const resolvedTemplateDirectory = this.settings.templateDirectory === "/"
    ? vaultPath
    : path.join(vaultPath, this.settings.templateDirectory);

// Resolve the template file
const templateFilePath = this.settings.templateFileName
    ? path.join(resolvedTemplateDirectory, this.settings.templateFileName)
    : null;

// Validate template file existence
if (templateFilePath && !(await this.app.vault.adapter.exists(templateFilePath))) {
    throw new Error(`Template file does not exist: ${templateFilePath}`);
}

// Resolve the directory path
const resolvedDirectory = this.settings.fileDirectory === "/"
    ? vaultPath
    : path.join(vaultPath, this.settings.fileDirectory);

// Ensure directory ends with a slash
const fileDirectory = resolvedDirectory.endsWith("/")
    ? resolvedDirectory
    : `${resolvedDirectory}/`;

// Construct the full file path
const fileName = `${fileDirectory}${filePrefix}LNL ${fileNameAuthor} ${year} ${sanitizedTitle}.md`;

        await this.app.vault.create(`${folderPath}/${fileName}`, populatedContent);
        console.log(`Created Markdown file: ${folderPath}/${fileName}`);
      }
    } catch (error) {
      console.error(`Error processing file ${file.path}:`, error);
    }
  }

  new Notice("BibTeX entries imported successfully!");
}

// helper plugin

buildAuthorTag(authorStr: string): string {
  // e.g. "Northrup Frye" => "FryeN"
  // e.g. "Frye, Northrup" => "FryeN"
  const trimmed = authorStr.trim();
  if (!trimmed || trimmed.toLowerCase() === "unknown author") {
    return "UnknownAuthor";
  }

  // Check if there's a comma => typically "Last, First"
  if (trimmed.includes(",")) {
    // e.g. "Frye, Northrup Bertram"
    const [last, firstRest] = trimmed.split(",", 2).map((s) => s.trim());
    // Only the first initial of the firstRest
    const firstInitial = firstRest?.[0] ?? "";
    return `${last}${firstInitial}`;
  } else {
    // e.g. "Northrup Bertram Frye"
    const parts = trimmed.split(/\s+/);
    // last part = last name
    const last = parts.pop() || "";
    const first = parts.shift() || ""; 
    const firstInitial = first?.[0] ?? "";
    return `${last}${firstInitial}`;
  }
}



  // Plugin cleanup (optional, for when the plugin is disabled)
  onunload() {
    console.log("BibLaTeX Plugin unloaded.");
  }
}
