import { App, Editor, MarkdownPreviewView, ItemView, WorkspaceLeaf, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

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

export default class CharacterBuilder extends Plugin {
	settings: CharacterBuilderSettings;

	async onload(): void {
		await this.loadSettings();
		await this.initCache();

		this.registerView(
			VIEW_TYPE_CHARACTER_BUILDER_FULL,
			(leaf) => new CharacterBuilderFullView(leaf),
		);

		// This creates an icon in the left ribbon.
		this.addRibbonIcon('calculator', 'Create new character', async (evt: MouseEvent) => {
			const leaf = this.app.workspace.getLeaf();
			await leaf.setViewState({ type: VIEW_TYPE_CHARACTER_BUILDER_FULL, active: true, });
			this.app.workspace.revealLeaf(leaf);
		});

		this.addRibbonIcon('dice', 'Create character from template', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new CharacterBuilderModal(this.app).open();
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CharacterBuilderSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		//this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHARACTER_BUILDER_FULL);
	}

	async initCache(): void {
		window.CharacterBuilderCache = CharacterBuilderCache; //DEBUG

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

	async loadSettings(): void {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): void {
		await this.saveData(this.settings);
	}
}

const VIEW_TYPE_CHARACTER_BUILDER_FULL = "character-builder-full-view";

class CharacterBuilderFullView extends ItemView {
	char_name: string;
	settings: string;
	race: string;
	subrace: string;
	feature: string;
	maxArmor: number = 2;
	initialTalentCount: number;

	constructor(leaf: WorkspaceLeaf) {
	  super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CHARACTER_BUILDER_FULL;
	}

	getDisplayText(): string {
		return "Créateur de personnage";
	}

	async onOpen(): void {
		const {contentEl} = this;

		contentEl.createEl("h2", { text: "Création de personnage" });

		new Setting(contentEl)
			.setName("Nom de personnage")
			.addText(text => text.onChange(value => this.char_name = value).setValue(this.char_name));

		const settingDropdown = new Setting(contentEl);

		const raceGroup = this.group(contentEl, "Race du personnage");

		const raceDropdown = new Setting(raceGroup);
		const subraceDropdown = new Setting(raceGroup);
		const featureDropdown = new Setting(raceGroup);

		subraceDropdown.setName("Sous race")
			.addDropdown(dropdown => dropdown.onChange(value => {
				this.subrace = value;
				subraceDropdown.setDesc("");
				MarkdownPreviewView.renderMarkdown(this.heading(`races/${this.settings}/content/${this.race}`, `races/${this.settings}/metadata/${this.race}`, value), subraceDropdown.descEl, this.race.path);
			}).setDisabled(false));
		featureDropdown.setName("Bonus de race")
			.addDropdown(dropdown => dropdown.onChange(value => {
				this.feature = value;
				featureDropdown.setDesc("");
				const content = CharacterBuilderCache.cache(`races/${this.settings}/content/${this.race}`);
				MarkdownPreviewView.renderMarkdown(this.paragraphsOfHeading(`races/${this.settings}/metadata/${this.race}`, "BONUS RACIA").splice(1).map(e => content.substring(e.position.start.offset, e.position.end.offset)).filter(e => e.startsWith(`**${value}**`))[0], featureDropdown.descEl, this.race.path);
			}).setDisabled(false));

		raceDropdown.setName("Race")
			.addDropdown(dropdown => dropdown.onChange(async value => {
				this.race = value;

				this.subrace = "";
				this.feature = "";

				subraceDropdown.setDesc("");
				featureDropdown.setDesc("");

				const race = CharacterBuilderCache.cache(`races/${this.settings}/metadata/${value}`);

				if(!CharacterBuilderCache.cache(`races/${this.settings}/content/${value}`))
					CharacterBuilderCache.cache(`races/${this.settings}/content/${value}`, await this.app.vault.cachedRead(this.app.vault.getAbstractFileByPath(race.path)));

				const content = CharacterBuilderCache.cache(`races/${this.settings}/content/${value}`);

				raceDropdown.setDesc("");

				const sections = this.paragraphsOfHeading(`races/${this.settings}/metadata/${value}`, "BONUS RACIA").splice(1);

				console.log(sections.map(e => content.substring(e.position.start.offset, e.position.end.offset)));
				console.log(sections.map(e => /\*\*(.+)\*\*/.exec(content.substring(e.position.start.offset, e.position.end.offset))));

				this.dropdown(subraceDropdown, race.headings.filter(e => e.level === 3).map(e => e.heading), this.subrace);
				this.dropdown(featureDropdown, sections.map(e => /\*\*(.+)\*\*/.exec(content.substring(e.position.start.offset, e.position.end.offset))).filter(e => e !== null && e[1]).map(e => e[1]), this.feature);
			}).setDisabled(false));

		settingDropdown.setName("Univers")
			.addDropdown(dropdown => {
				Object.keys(CharacterBuilderCache.cache("races")).forEach(e => dropdown.addOption(e, e))
							dropdown.onChange(value => {

								this.race = "";
								this.subrace = "";
								this.feature = "";

								raceDropdown.setDesc("");
								subraceDropdown.setDesc("");
								featureDropdown.setDesc("");

								this.settings = value;
								this.dropdown(raceDropdown, CharacterBuilderCache.cache(`races/${value}/names`), this.race);
							}).setValue(this.settings);
				if(!!this.settings) dropdown.changeCallback(this.settings); });

		const armorSlider = new Setting(contentEl);

		armorSlider.setName(`Armure max`).setDesc(`L'armure maximum determine le nombre de talents disponibles au niveau 1.`)
			.addSlider(slider => slider.setLimits(2, 6, 2).onChange(value => {
				this.maxArmor = value;
				this.initialTalentCount = 6 - value / 2;

				armorSlider.setName(`Armure max (${this.maxArmor})`).setDesc(`L'armure maximum determine le nombre de talents disponibles au niveau 1 (${this.initialTalentCount}).`);
			}).setValue(this.maxArmor));

		new Setting(contentEl)
			.addButton(btn => btn.setButtonText('Créer').onClick(console.log));
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

	dropdown(elmt: Setting, options: string[], value: string): void
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

	paragraphsOfHeading(metadataPath: string, heading: string, includeHeading: boolean = false): SectionCache[]
	{
		const metadata = CharacterBuilderCache.cache(metadataPath), result = [];

		const head = metadata.headings.find(e => e.heading.includes(heading))?.position.end.offset;
		if(head === undefined)
			return result;

		for(let i = 0; i < metadata.sections.length; i++)
		{
			const sec = metadata.sections[i];
			if(includeHeading && head === sec.position.end.offset)
				result.push(sec);

			if(head < sec.position.start.offset && sec.type === "heading")
				break;

			if(head < sec.position.start.offset)
				result.push(sec);
		}

		for(let i = result.length - 1; i > 0; i--)
		{
		    if(result[i].type !== "paragraph")
		    {
		        result[i - 1].position.end = result[i].position.end;
		        result.splice(i, 1);
		    }
		}
		return result;
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

		containerEl.createEl('h2', {text: 'Paramètres du créateur de personnage.'});

		new Setting(containerEl)
			.setName('Dossier des personnages')
			.setDesc('Lien vers le dossier des personnages')
			.addText(text => text
				.setValue(this.plugin.settings.folder)
				.onChange(async (value) => {
					this.plugin.settings.folder = value;
					await this.plugin.saveSettings();
				}));
	}
}

class Component
{
	setting: Setting;

	desc(md: string, path?: string): Component
	{
		MarkdownPreviewView.renderMarkdown(md, this.setting.descEl, path);
		return this;
	}
	name(name: string): Component
	{
		this.setting.setName(name);
		return this;
	}
	disable(state: boolean)
	{
		this.setting.setDisabled(state);
	}
	value(value: string|number)
	{
		this.setting.
	}
	change(cb: (value: string|number) => void)
	{

	}
}