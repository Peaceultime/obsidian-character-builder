import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface CharacterBuilderSettings {
	folder: string;
}

const DEFAULT_SETTINGS: CharacterBuilderSettings = {
	folder: 'Characters'
}

class CharacterBuilderCache {
	static _cache = {};
	static cache(path: string, value: string|number|undefined)
	{
		if(!!value)
			return CharacterBuilderCache.write_cache(path, value);
		else
			return CharacterBuilderCache.read_cache(path);
	}
	private static read_cache(path: string)
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
	private static write_cache(path: string, value: string|number)
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

		console.log(CharacterBuilderCache._cache)
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
		const files = this.app.vault.getMarkdownFiles();

		CharacterBuilderCache.cache("names/races", files.filter(e => e.path.includes("Liste des Races")).map(e => e.basename));
		CharacterBuilderCache.cache("names/talents", files.filter(e => e.path.includes("2. Talents")).map(e => e.basename));
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class CharacterBuilderModal extends Modal {
	name: string;
	race: string;
	subrace: string;
	feature: string;

	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let raceDropdown, subraceDropdown, featureDropdown;
		const {contentEl} = this;

		contentEl.createEl("h2", { text: "Character creation" });

		new Setting(contentEl)
			.setName("Character Name")
			.addText(text => text.onChange(value => this.name = value));

		contentEl.createEl("h4", { text: "Character's Race" });

		raceDropdown = new Setting(contentEl)
			.setName("Race")
			.addDropdown(dropdown => 
				dropdown.addOptions(CharacterBuilderCache.cache("names/races").forEach(e => dropdown.addOption(e, e)))
						.onChange(value => { this.race = value; }));

		subraceDropdown = new Setting(contentEl)
			.setName("Sub-Race")
			.addText(text => text.onChange(value => this.subrace = value));

		featureDropdown = new Setting(contentEl)
			.setName("Race Feature")
			.addText(text => text.onChange(value => this.feature = value));

		new Setting(contentEl)
			.addButton(btn => btn.setButtonText('Create')/*.setIcon('plus-circle')*/.onClick(console.log));
	}

	listen()
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
					this.plugin.settings.character = value;
					await this.plugin.saveSettings();
				}));
	}
}
