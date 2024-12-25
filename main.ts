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

// Process files
for (const file of files) {
    try {
        const content = await this.app.vault.read(file);
        console.log(`Processing file: ${file.path}`);
        console.log("File content:", content);

        const parsedResult = BibtexParser.parse(content);
        const parsedEntries = parsedResult.entries;
        console.log("Parsed entries:", parsedEntries);

        for (const entry of parsedEntries.slice(0, this.settings.entryLimit)) {
            const title = fields.title || "Untitled";
            const sanitizedTitle = this.sanitizeString(
                title.split(/\s+/).slice(0, 4).join(" ")
            );

            const fileName = `${fileDirectory}${filePrefix}LNL ${fileNameAuthor} ${year} ${sanitizedTitle}.md`;

            // Write the file
            await this.app.vault.create(fileName, populatedContent);
            console.log(`Created Markdown file: ${fileName}`);
        }
    } catch (error) {
        console.error(`Error processing file ${file.path}:`, error);
    }
}

new Notice("BibTeX entries imported successfully!");
}

// Helper plugin method: buildAuthorTag
buildAuthorTag(authorStr: string): string {
    const trimmed = authorStr.trim();
    if (!trimmed || trimmed.toLowerCase() === "unknown author") {
        return "UnknownAuthor";
    }

    // Check if there's a comma => typically "Last, First"
    if (trimmed.includes(",")) {
        const [last, firstRest] = trimmed.split(",", 2).map((s) => s.trim());
        const firstInitial = firstRest?.[0] ?? "";
        return `${last}${firstInitial}`;
    } else {
        const parts = trimmed.split(/\s+/);
        const last = parts.pop() || "";
        const first = parts.shift() || "";
        const firstInitial = first?.[0] ?? "";
        return `${last}${firstInitial}`;
    }
}

// Plugin cleanup
onunload() {
    console.log("BibLaTeX Plugin unloaded.");
} // End of onunload()

} // End of BibLaTeXPlugin class
