import { PluginSettingTab, Setting } from 'obsidian';
import { Dropdown, TextField, SuggestField } from 'src/components.ts';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';

export interface CharacterBuilderSettings {
	charactersFolder: string;
	racesFolder: string;
	talentsFolder: string;

	characterTemplate: string,

	maxStat: number;
	maxInitialStat: number;
	minStat: number;
	statAmount: number;

	substatAmount: number;
}

export interface ViewSaveData {
	metadata: Metadata;
	path: string;
	active: boolean;
}

export interface SaveData {
	settings: CharacterBuilderSettings;
	views: ViewSaveData[];
}

export const DEFAULT_SETTINGS: SaveData = {
	views: [],
	settings: {
		charactersFolder: '99. Personnages',
		racesFolder: '3. Races/Liste des Races',
		talentsFolder: '2. Classes/2. Talents',
		
		characterTemplate: '99. Personnages/99. Template.md',

		maxStat: 60,
		maxInitialStat: 45,
		minStat: 15,
		statAmount: 245,

		substatAmount: 62,
	}
};

export class CharacterBuilderSettingTab extends PluginSettingTab {
	plugin: CharacterBuilder;
	dirty: boolean = false;

	constructor(app: App, plugin: CharacterBuilder) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Dossiers'});

		new SuggestField(containerEl, "Dossier des personnages", false).link(this.plugin.savedData.settings, "charactersFolder").onSuggest(v => this.app.vault.getAllLoadedFiles().filter(e => e.hasOwnProperty("children") && e.path.toLowerCase().includes(v.toLowerCase())).map(e => e.path)).onSelect(value => this.dirty = true);
		new SuggestField(containerEl, "Dossier des races", false).link(this.plugin.savedData.settings, "racesFolder").onSuggest(v => this.app.vault.getAllLoadedFiles().filter(e => e.hasOwnProperty("children") && e.path.toLowerCase().includes(v.toLowerCase())).map(e => e.path)).onSelect(value => this.dirty = true);
		new SuggestField(containerEl, "Dossier des talents", false).link(this.plugin.savedData.settings, "talentsFolder").onSuggest(v => this.app.vault.getAllLoadedFiles().filter(e => e.hasOwnProperty("children") && e.path.toLowerCase().includes(v.toLowerCase())).map(e => e.path)).onSelect(value => this.dirty = true);

		containerEl.createEl('h2', {text: 'Modèles'});

		new SuggestField(containerEl, "Modèle de fiche", false).link(this.plugin.savedData.settings, "characterTemplate").onSuggest(v => this.app.vault.getAllLoadedFiles().filter(e => !e.hasOwnProperty("children") && e.path.toLowerCase().includes(v.toLowerCase())).map(e => e.path)).onChange(value => this.dirty = true);

		containerEl.createEl('h2', {text: 'Stats principales'});

		new TextField(containerEl, "Max de point par stat", false).link(this.plugin.savedData.settings, "maxStat").onChange(value => this.dirty = true);
		new TextField(containerEl, "Min de points par stat", false).link(this.plugin.savedData.settings, "minStat").onChange(value => this.dirty = true);
		new TextField(containerEl, "Max de point par stat à la création", false).link(this.plugin.savedData.settings, "maxInitialStat").onChange(value => this.dirty = true);
		new TextField(containerEl, "Points total disponible à la création", false).link(this.plugin.savedData.settings, "statAmount").onChange(value => this.dirty = true);

		containerEl.createEl('h2', {text: 'Stats secondaires'});

		new TextField(containerEl, "Points total disponible au niveau 1", false).link(this.plugin.savedData.settings, "substatAmount").onChange(value => this.dirty = true);
	}

	hide()
	{
		if(this.dirty)
		{
			this.plugin.savePluginData();
			this.plugin.settings = Cache.cache("settings", this.plugin.savedData.settings);
		}

		this.dirty = false;
		super.hide();
	}
}
