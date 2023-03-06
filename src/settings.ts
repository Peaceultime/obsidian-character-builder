import { PluginSettingTab, Setting } from 'obsidian';
import { Dropdown, TextField } from 'src/components.ts';

export interface CharacterBuilderSettings {
	charactersFolder: string;
	racesFolder: string;
	talentsFolder: string;
	characterTemplate: string,
	maxStat: number;
	maxInitialStat: number;
	minStat: number;
	statAmount: number;
}

export const DEFAULT_SETTINGS: CharacterBuilderSettings = {
	charactersFolder: '99. Personnages',
	racesFolder: '3. Races/Liste des Races',
	talentsFolder: '2. Classes/2. Talents',
	characterTemplate: '99. Personnages/99. Template',
	maxStat: 60,
	maxInitialStat: 45,
	minStat: 15,
	statAmount: 245,
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

		new TextField(containerEl, "Dossier des personnages", false).link(this.plugin.settings, "charactersFolder").onChange(value => this.dirty = true);
		new TextField(containerEl, "Dossier des races", false).link(this.plugin.settings, "racesFolder").onChange(value => this.dirty = true);
		new TextField(containerEl, "Dossier des talents", false).link(this.plugin.settings, "talentsFolder").onChange(value => this.dirty = true);


		containerEl.createEl('h2', {text: 'Modèles'});

		new TextField(containerEl, "Modèle de fiche", false).link(this.plugin.settings, "characterTemplate").onChange(value => this.dirty = true);

		containerEl.createEl('h2', {text: 'Stats principales'});

		new TextField(containerEl, "Max de point par stat", false).link(this.plugin.settings, "maxStat").onChange(value => this.dirty = true);
		new TextField(containerEl, "Min de points par stat", false).link(this.plugin.settings, "minStat").onChange(value => this.dirty = true);
		new TextField(containerEl, "Max de point par stat à la création", false).link(this.plugin.settings, "maxInitialStat").onChange(value => this.dirty = true);
		new TextField(containerEl, "Points total disponnible à la création", false).link(this.plugin.settings, "statAmount").onChange(value => this.dirty = true);
	}

	hide()
	{
		if(this.dirty)
			this.plugin.saveSettings();

		this.dirty = false;
		super.hide();
	}
}