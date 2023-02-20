import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface CharacterBuilderSettings {
	folder: string;
}

const DEFAULT_SETTINGS: CharacterBuilderSettings = {
	folder: 'Characters'
}

class CharacterBuilderCache {
	static _cache = {};
	static cache(path: string, value: any): any
	{
		if(!!value)
			return CharacterBuilderCache.write_cache(path, value);
		else
			return CharacterBuilderCache.read_cache(path);
	}
	private static read_cache(path: string): any
	{
		const keys = path.split("/");
		let value = CharacterBuilderCache._cache;
		for(let i = 0; i < keys.length; i++)
		{
			if(value.hasOwnProperty(keys[i]))
				value = value[keys[i]];
			else
				return undefined;
		}
		return value;
	}
	private static write_cache(path: string, value: string|number): any
	{
		const keys = path.split("/");
		let val = CharacterBuilderCache._cache;
		for(let i = 0; i < keys.length - 1; i++)
		{
			if(val.hasOwnProperty(keys[i]))
				val = val[keys[i]];
			else
				val = val[keys[i]] = {};
		}
		val[keys[keys.length - 1]] = value;

		return value;
	}
}

const characterBuilderCache = new CharacterBuilderCache();

export default class CharacterBuilder extends Plugin {
	settings: CharacterBuilderSettings;

	async onload() {
		await this.loadSettings();
		await this.initCache();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('calculator', 'Create new character', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new CharacterBuilderModal(this.app).open();
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CharacterBuilderSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		//this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async initCache() {
		window.CharacterBuilderCache = CharacterBuilderCache;

		const files = this.app.vault.getMarkdownFiles();

		const races = files.filter(e => e.path.includes("Liste des Races")).map(this.getMetadata.bind(this));

		const groups = races.reduce((p, v) => { if(!p.includes(v.parent)) p.push(v.parent); return p; }, []);

		for(let i = 0; i < groups.length; i++)
		{
			const r = races.filter(e => e.parent === groups[i]);
			CharacterBuilderCache.cache(`races/${groups[i]}/metadata`, r.reduce((p, v) => { p[v.name] = v; return p; }, {}));
			CharacterBuilderCache.cache(`races/${groups[i]}/names`, r.map(e => e.name));
		}

		const talents = files.filter(e => e.path.includes("2. Talents")).map(this.getMetadata.bind(this));
		CharacterBuilderCache.cache("talents/metadata", talents.reduce((p, v) => { p[v.name] = v; return p; }, {}));
		CharacterBuilderCache.cache("talents/names", talents.map(e => e.name));
	}

	getMetadata(file: TFile): any {
		return {...this.app.metadataCache.getFileCache(file), name: file.basename, parent: file.parent.name, path: file.path};
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class CharacterBuilderModal extends Modal {
	static char_name: string;
	static settings: string;
	static race: string;
	static subrace: string;
	static feature: string;

	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;

		contentEl.createEl("h2", { text: "Character creation" });

		new Setting(contentEl)
			.setName("Character Name")
			.addText(text => text.onChange(value => CharacterBuilderModal.char_name = value).setValue(CharacterBuilderModal.char_name));

		const settingDropdown = new Setting(contentEl);

		const raceGroup = this.group(contentEl, "Character's Race");

		const raceDropdown = new Setting(raceGroup);
		const subraceDropdown = new Setting(raceGroup);
		const featureDropdown = new Setting(raceGroup);

		subraceDropdown.setName("Sub-Race")
			.addDropdown(dropdown => dropdown.onChange(value => {
				CharacterBuilderModal.subrace = value;
			}).setDisabled(false));
		featureDropdown.setName("Race Feature")
			.addDropdown(dropdown => dropdown.onChange(value => {
				CharacterBuilderModal.feature = value;
			}).setDisabled(false));

		raceDropdown.setName("Race")
			.addDropdown(dropdown => dropdown.onChange(async value => {
				CharacterBuilderModal.race = value;
				const race = CharacterBuilderCache.cache(`races/${CharacterBuilderModal.settings}/metadata/${value}`);

				if(!CharacterBuilderCache.cache(`races/${CharacterBuilderModal.settings}/content/${value}`))
					CharacterBuilderCache.cache(`races/${CharacterBuilderModal.settings}/content/${value}`, await this.app.vault.cachedRead(this.app.vault.getAbstractFileByPath(race.path)));

				const content = CharacterBuilderCache.cache(`races/${CharacterBuilderModal.settings}/content/${value}`);

				(new MarkdownPreviewView(raceDropdown.descEl)).renderMarkdown(this.heading(`races/${CharacterBuilderModal.settings}/content/${value}`, `races/${CharacterBuilderModal.settings}/metadata/${value}`, "TRAITS"), raceDropdown.descEl, race.path);
				//raceDropdown.setDesc();

				this.dropdown(subraceDropdown, race.headings.filter(e => e.level === 3).map(e => e.heading), CharacterBuilderModal.subrace);
				this.dropdown(featureDropdown, race.listItems.map(e => content.substring(e.position.start.offset, e.position.end.offset)), CharacterBuilderModal.feature);
			}).setDisabled(false));

		settingDropdown.setName("RPG Settings")
			.addDropdown(dropdown => {
				Object.keys(CharacterBuilderCache.cache("races")).forEach(e => dropdown.addOption(e, e))
							dropdown.onChange(value => {
								CharacterBuilderModal.settings = value;
								this.dropdown(raceDropdown, CharacterBuilderCache.cache(`races/${value}/names`), CharacterBuilderModal.race);
							}).setValue(CharacterBuilderModal.settings);
				if(!!CharacterBuilderModal.settings) dropdown.changeCallback(CharacterBuilderModal.settings); });

		new Setting(contentEl)
			.addButton(btn => btn.setButtonText('Create')/*.setIcon('plus-circle')*/.onClick(console.log));
	}

	group(elmt: HTMLElement, title: string): HTMLDivElement
	{
		const container = elmt.createDiv({ cls: "character-builder-group-container" });
		const titleDiv = container.createDiv({cls: "character-builder-group-collapsible"});
		titleDiv.createSvg("svg", {attr: {
			"xmlns": "http://www.w3.org/2000/svg",
			"width": "24",
			"height": "24",
			"viewBox": "0 0 24 24",
			"fill": "none",
			"stroke": "currentColor",
			"stroke-width": "2",
			"stroke-linecap": "round",
			"stroke-linejoin": "round"
		}, cls: "character-builder-group-collapse-icon"}).createSvg("path", {attr: { "d": "M3 8L12 17L21 8" }});
		titleDiv.createDiv({cls: "character-builder-group-title", text: title});
		titleDiv.addEventListener("click", e => {
			titleDiv.parentElement.classList.toggle("character-builder-group-collapsed");
		});
		return container.createDiv({cls: "character-builder-group-content"});
	}

	dropdown(elmt: Setting, options: string[], value: string)
	{
		let i, dropdown = elmt.components[0], L = elmt.components[0].selectEl.options.length - 1;
		for(i = L; i >= 0; i--)
			dropdown.selectEl.remove(i);

		if(!options || !Array.isArray(options))
		{
			dropdown.setDisabled(true);
			return;
		}
		else
		{
			dropdown.setDisabled(false);
		}

		for(i = 0; i < options.length; i++)
			dropdown.addOption(options[i], options[i]);

		dropdown.setValue(value);
		if(!!value)
		{
			dropdown.changeCallback(value);
		}
	}

	heading(contentPath: string, metadataPath: string, heading: string): string
	{
		const content = CharacterBuilderCache.cache(contentPath);
		const metadata = CharacterBuilderCache.cache(metadataPath);

		const idx = metadata.headings.findIndex(e => e.heading.includes(heading));
		if(idx === -1)
			return "";

		return content.substring(metadata.headings[idx].position.end.offset, metadata.headings.length - 1 === idx ? content.length : metadata.headings[idx + 1].position.start.offset);
	}
}

class CharacterBuilderSettingTab extends PluginSettingTab {
	plugin: CharacterBuilder;

	constructor(app: App, plugin: CharacterBuilder) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Settings for character builder.'});

		new Setting(containerEl)
			.setName('Character Folder')
			.setDesc('Link to the character folder')
			.addText(text => text
				.setValue(this.plugin.settings.folder)
				.onChange(async (value) => {
					this.plugin.settings.folder = value;
					await this.plugin.saveSettings();
				}));
	}
}
