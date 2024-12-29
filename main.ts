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

/**
 * Helper function to sanitize strings
 * Removes invalid characters for filenames, tags, and other uses.
 * @param {string} input - The string to sanitize.
 * @param {boolean} preserveSpaces - Whether to preserve spaces (default: false).
 * @param {boolean} forTags - Whether the string is being sanitized for tags (default: false).
 * @returns {string} Sanitized string.
 */
sanitizeString(input: string, preserveSpaces: boolean = false, forTags: boolean = false): string {
    let sanitized = input
        .replace(/[\/\\:*?"<>|]/g, "") // Remove invalid characters
        .replace(/\./g, "_") // Replace periods with underscores
.replace(/[()]/g, "_") // Replace parentheses with underscores to preserve grouping
        .trim(); // Remove leading/trailing whitespace

    if (!preserveSpaces) {
        sanitized = sanitized.replace(/\s+/g, forTags ? "_" : " "); // Replace spaces with underscores for tags, keep spaces for titles
    }

    // Remove trailing underscores that may result from parentheses
    sanitized = sanitized.replace(/_+$/g, "");

    // Normalize consecutive underscores to single (tags only)
    return forTags ? sanitized.replace(/_+/g, "_") : sanitized;
}

/**
 * Helper function to parse BibTeX authors into a normalized format
 * @param {string | Array | Object} authorsRaw - Raw authors data from BibTeX
 * @returns {Array<{ lastName: string, firstName: string }>} Array of parsed authors
 */
parseAuthors(authorsRaw: string | Array<any> | Object): Array<{ lastName: string; firstName: string }> {
    const parsedAuthors: Array<{ lastName: string; firstName: string }> = [];

    if (typeof authorsRaw === "string") {
        const cleaned = authorsRaw.replace(/[{}]/g, "").trim(); // Remove braces
        const authorSplits = cleaned.split(/\s+and\s+/i);

        authorSplits.forEach((authorStr) => {
            if (authorStr.trim().length === 0) return; // Skip empty strings

            // Handle corporate authors explicitly
if (!authorStr.includes(",") && !authorStr.match(/\\s+/)) {
                parsedAuthors.push({ lastName: authorStr, firstName: "" }); // Treat as corporate author
            } else {
                const [last, first] = authorStr.includes(",")
                    ? authorStr.split(",").map((s) => s.trim()) // Format: "Last, First"
                    : [authorStr.split(/\s+/).pop() || "", authorStr.split(/\s+/).slice(0, -1).join(" ")]; // Format: "First Last"
                parsedAuthors.push({ lastName: last, firstName: first });
            }
        });
} else if (Array.isArray(authorsRaw)) {
    authorsRaw.forEach((author) => {
        if (author.name) { // Handle corporate authors
            parsedAuthors.push({
                lastName: author.name,
                firstName: "",
            });
        } else {
            parsedAuthors.push({
                lastName: author.lastName || "Unknown",
                firstName: author.firstName || "",
            });
        }
    });
}

    return parsedAuthors;
}


/**
 * Helper function to process author names
 * @param {string | Array | Object} authorsRaw - Raw authors data
 * @returns {Object} Object with formatted tags, file name author, and YAML authors
 */
processAuthors(authorsRaw: string | Array<any> | Object) {
    const parsedAuthors = this.parseAuthors(authorsRaw); // Normalize authors
    const authorTags: string[] = [];
    const authorsYaml: string[] = [];

    parsedAuthors.forEach(({ lastName, firstName }) => {
        if (lastName === "Unknown Author") return; // Skip processing for unknown authors

        const sanitizedTag = this.sanitizeString(`${lastName}`, false, true);
        authorTags.push(`#${sanitizedTag}`); // Tags: LastnameFirstInitial

        const yamlAuthor = firstName ? `${firstName} ${lastName}` : lastName;
        authorsYaml.push(yamlAuthor);
    });

    const fileNameAuthor = parsedAuthors.length > 1
        ? `${parsedAuthors[0].lastName} et al` // Use only the first author for file names
        : parsedAuthors[0]?.lastName || ""; // Single author: just the last name

    return { authorTags: [...new Set(authorTags)], fileNameAuthor, authorsYaml: authorsYaml.join("; ") };
}


/**
 * Generate a file name based on provided metadata.
 * This function constructs a file name by combining authors, year, and title,
 * while adhering to fallback rules for missing data. If all metadata is missing,
 * it uses a default pattern with a timestamp.
 *
 * @param {Record<string, string | undefined>} metadata - An object containing authors, year, title, and shorttitle.
 * @param {string} dateStamp - A timestamp in the format "YYYY-MM-DD HH:MM" to use as a fallback.
 * @returns {string} - The generated file name.
 */
generateFileName(metadata: Record<string, string | undefined>, dateStamp: string): string {
const prefix = "LNL"; // Explicitly define the prefix for the file name
const authors = metadata.authors && metadata.authors !== "Unknown Author" ? metadata.authors : "";
const year = metadata.year && metadata.year !== "Unknown Year" ? metadata.year : "";
const title = metadata.shorttitle || 
              (metadata.title && metadata.title !== "Unknown Title" && metadata.title !== "Untitled" ? metadata.title : "") || 
              metadata.publication || "";

    // Build the title components
    const components: string[] = [];
    if (authors) components.push(authors);
    if (year) components.push(year);
    if (title) components.push(this.sanitizeString(title));

    // If no meaningful components, use fallback
    if (components.length === 0) {
        return `${prefix} ${dateStamp}.md`;
    }

    return `${prefix} ${components.join(" ")}.md`;
}




/** 
 * Import BibTex function
 *
 *
 */
	async importBibTeX() {
	  const files = this.app.vault.getFiles().filter((file) => file.extension === "bib");
	  console.log("Found .bib files:", files.map((file) => file.path));

	// What to do if no file is found
	  if (files.length === 0) {
	    new Notice("No BibTeX files found in your vault.");
	    return;
	  }

	// Construct template
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
const shorttitle = fields.shorttitle ? this.sanitizeString(fields.shorttitle, true) : undefined;
const title = fields.title || shorttitle || "Untitled";

        //---------------------------------------------------
        // (1) AUTHOR TAGS => build an array like ["#FryeN", "#SmithJ"]
        //---------------------------------------------------
	const authorsRaw = fields.author || "Unknown Author";
const { authorTags, fileNameAuthor, authorsYaml } = this.processAuthors(fields.author || "Unknown Author");

        // We'll store them as a single-line YAML array: ["#FryeN","#SmithJ"]
        const authorsInlineArray = `["${authorTags.join('","')}"]`;

        //---------------------------------------------------
        // (2) KEYWORD TAGS => build an array like ["#Anglo_Saxon", "#Old_English"]
        //---------------------------------------------------
let keywordsHuman: string[] = [];
let keywordArray: string[] = []; // For tags

if (typeof fields.keywords === "string" && fields.keywords.trim()) {
    const cleaned = fields.keywords.replace(/[{}]/g, "").trim();
    if (cleaned) {
        const splitted = cleaned.split(",").map((k) => k.trim());
        keywordsHuman = splitted; // Human-readable for YAML
        keywordArray = splitted.map((kw) => `#${this.sanitizeString(kw, false, true)}`); // Tags
    }
} else if (Array.isArray(fields.keywords)) {
    keywordsHuman = fields.keywords.map((kw: string) => String(kw));
    keywordArray = fields.keywords.map((kw: string) => `#${this.sanitizeString(String(kw), false, true)}`); // Tags
}

// Generate human-readable and tag formats
const keywordsInlineArray = `["${keywordArray.join('","')}"]`;

	//---------------------------------------------------
	// Combine Tags => create a single tags array for Obsidian
	//---------------------------------------------------
	const combinedTags = [...authorTags, ...keywordArray];



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
authors: authorsYaml, // For the "Authors" line in the YAML
keywords: keywordsHuman.join(", "), // Human-readable for YAML
tags: `["${[...authorTags, ...keywordArray].join('","')}"]`, // Combined author tags and keyword tags
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

	// Truncate the title to the first three words and sanitize for file names
	const truncatedTitle = this.sanitizeString(
	    title.split(/\s+/).slice(0, 3).join(" "),
	    true // Preserve spaces for file titles
	);

// Build metadata for file name generation
const metadata = {
    authors: fileNameAuthor !== "Unknown" ? fileNameAuthor : undefined,
    year: year !== "unknown year" ? year : undefined,
    title: title || undefined,
    shorttitle: shorttitle || undefined, // Ensure you extract this earlier if not already done
};

// Generate the file name using the new logic
const fileName = this.generateFileName(metadata, new Date().toISOString().replace(/T/, ' ').replace(/\..+/, ''));

// Create the Markdown file
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
