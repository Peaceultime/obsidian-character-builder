import { App, Editor, MarkdownPreviewView, ItemView, WorkspaceLeaf, Modal, Notice, Plugin, PluginSettingTab, Setting, TextComponent } from 'obsidian';

interface CharacterBuilderSettings {
	charactersFolder: string;
	racesFolder: string;
	talentsFolder: string;
	maxStat: number;
	maxInitialStat: number;
	minStat: number;
	statAmount: number;
}
interface Substats {
	[name: string]: Stat;
}
const Stat = {
	initial: 0,
	bonus: 0,
	levels: 0,
} as const;
const StatBlock = {
	strength: {...Stat},
	dexterity: {...Stat},
	constitution: {...Stat},
	intelligence: {...Stat},
	perception: {...Stat},
	charisma: {...Stat},
	will: {...Stat},
} as const;
const StatBlockNames = {
	strength: "Force",
	dexterity: "Dextérité",
	constitution: "Constitution",
	intelligence: "Intelligence",
	perception: "Perception",
	charisma: "Charisme",
	will: "Volonté",
} as const;

const DEFAULT_SETTINGS: CharacterBuilderSettings = {
	charactersFolder: '99. Personnages',
	racesFolder: '3. Races/Liste des Races',
	talentsFolder: '2. Classes/2. Talents',
	maxStat: 60,
	maxInitialStat: 45,
	minStat: 15,
	statAmount: 245,
};

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
			(leaf) => new CharacterBuilderFullView(leaf, this.settings),
		);

		this.addRibbonIcon('calculator', 'Créer un nouveau personnage', async (evt: MouseEvent) => {
			const leaf = this.app.workspace.getLeaf();
			await leaf.setViewState({ type: VIEW_TYPE_CHARACTER_BUILDER_FULL, active: true, });
			this.app.workspace.revealLeaf(leaf);
		});

		this.addRibbonIcon('dice', 'Créer un nouveau personnage depuis les modèles', (evt: MouseEvent) => {
			new CharacterBuilderModal(this.app).open();
		});

		this.addSettingTab(new CharacterBuilderSettingTab(this.app, this));

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		//this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));

		window.CharacterBuilderCache = CharacterBuilderCache; //DEBUG
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHARACTER_BUILDER_FULL);
	}

	async initCache(): void {
		const files = this.app.vault.getMarkdownFiles();

		const races = (await Promise.all(files.filter(e => e.path.startsWith(this.settings.racesFolder + "/")).map(this.getRaceContent.bind(this)))).filter(e => !!e && !!e.content);

		const groups = races.reduce((p, v) => { if(!p.includes(v.parent)) p.push(v.parent); return p; }, []);

		for(let i = 0; i < groups.length; i++)
		{
			const r = races.filter(e => e.parent === groups[i]);

			CharacterBuilderCache.cache(`races/${groups[i]}/content`, r.reduce((p, v) => { p[v.name] = v; return p; }, {}));
		}

		const talents = files.filter(e => e.path.startsWith(this.settings.talentsFolder + "/")).map(this.getTalentContent.bind(this));
		CharacterBuilderCache.cache("talents/metadata", talents.reduce((p, v) => { p[v.name] = v; return p; }, {}));
	}

	async getRaceContent(file: TFile): any {
		const metadata = app.metadataCache.getFileCache(file);

        if(!metadata.hasOwnProperty("headings") || !metadata.hasOwnProperty("sections"))
            return;
        
        const content = await this.app.vault.cachedRead(this.app.vault.getAbstractFileByPath(file.path));
        const desc = content.substring(metadata.headings[0].position.start.offset, metadata.headings[2].position.start.offset - 1);
        const subraces = metadata.headings.slice(0, metadata.headings.findIndex(e => e.heading.startsWith("BONUS RACIA"))).map((e, i) => i).slice(3).map(e => metadata.headings[e].heading).reduce((p, v) => {
        	p[v] = this.contentOfHeading(metadata, content, v, true); return p;
        }, {});
        const idx = metadata.headings.findIndex(e => e.heading.startsWith("BONUS RACIA"));
        const start = metadata.headings[idx].position.end.offset, end = idx === metadata.headings.length - 1 ? content.length - 1 : metadata.headings[idx + 1].position.start.offset;
        const features = metadata.sections.reduce((p, v) => { 
        	if(v.position.start.offset >= start && v.position.end.offset <= end) 
        	{
        		const paragraph = content.substring(v.position.start.offset, v.position.end.offset);
        		const match = /\*\*(.+)\*\*/g.exec(paragraph);

        		if(match)
        			p[match[1].replace(/\*/g, "").replace(".", "")] = paragraph;
        	}
        	return p;
        }, {});
        
        return { features: features, subraces: subraces, content: desc, name: file.basename, parent: file.parent.name, path: file.path };
	}

	async getTalentContent(file: TFile): any {

	}

	async loadSettings(): void {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): void {
		await this.saveData(this.settings);
		await this.initCache();
	}

	contentOfHeading(metadata: any, content: string, heading: string, includeHeading: boolean = false)
	{
		const head = metadata.headings.find(e => e.heading === heading);
		const start = includeHeading ? head.position.start.offset : head.position.end.offset;
		let end;
		
		for(let i = 0; i < metadata.sections.length; i++)
		{
			const sec = metadata.sections[i];
			if(start < sec.position.start.offset && sec.type === "heading")
				break;

			if(start < sec.position.start.offset)
				end = sec.position.end.offset;
		}
		return content.substring(start, end);
	}
}

const VIEW_TYPE_CHARACTER_BUILDER_FULL = "character-builder-full-view";

class CharacterBuilderFullView extends ItemView {
	settings: CharacterBuilderSettings;

	armor: Stat;
	initialTalentCount: number = 5;
	statBlock: StatBlock;

	substats: Substats = {};

	constructor(leaf: WorkspaceLeaf, settings: CharacterBuilderSettings) {
	  super(leaf);
	  this.settings = settings;
	  this.armor = Object.assign({}, Stat, { maxLimit: 8 });
	  this.statBlock = Object.assign({}, StatBlock);
	}

	getViewType(): string {
		return VIEW_TYPE_CHARACTER_BUILDER_FULL;
	}

	getDisplayText(): string {
		return !!this.name ? `Création de ${this.name}` : `Création de personnage`;
	}

	async onOpen(): void {
		const {contentEl} = this;

		contentEl.empty();

		contentEl.createEl("h2", { text: "Création de personnage" });

		new TextField(contentEl, "Nom de personnage").link(this, "name");

		const settingDropdown = new Dropdown(contentEl, "Univers", false).source(this, `races`).link("setting");
		const raceGroup = this.group(contentEl, "Race du personnage", true);
		const raceDropdown = new Dropdown(raceGroup, "Race", this).source(this, `races/{setting}/content`).link("race");
		const subraceDropdown = new Dropdown(raceGroup, "Sous-race").source(this, `races/{setting}/content/{race}/subraces`).link("subrace");
		const featureDropdown = new Dropdown(raceGroup, "Bonus racial").source(this, `races/{setting}/content/{race}/features`).link("feature");

		settingDropdown.onChange(value => {
			raceDropdown.update();
			subraceDropdown.update();
			featureDropdown.update();
		});
		raceDropdown.onChange(value => {
			subraceDropdown.update();
			featureDropdown.update();
		});

		const armorSlider = new Setting(contentEl);

		armorSlider.setName(`Armure max`).setDesc(`L'armure maximum determine le nombre de talents disponibles au niveau 1.`)
		.addSlider(slider => slider.setLimits(2, 6, 2).onChange(value => {
			this.armor.initialLimit = value;
			this.initialTalentCount = 6 - value / 2;

			armorSlider.setName(`Armure max (${this.armor.initialLimit})`).setDesc(`L'armure maximum determine le nombre de talents disponibles au niveau 1 (${this.initialTalentCount}).`);
		}).setValue(2));

		const statBlockContainer = contentEl.createDiv({ cls: "character-builder-statblock-container" });

		const stats = Object.keys(this.statBlock);
		let remaining = this.settings.statAmount;
		this.table(statBlockContainer, Object.values(StatBlockNames), ["Statistique", "Bonus racial", "Réussite haute", "Réussite extrème"], (elmt, col, row) => {
			const stat = this.statBlock[stats[col]];
			switch(row)
			{
				case 0:
					new HTMLStatElement(elmt, this.settings.minStat, this.settings.maxInitialStat).change(function(oldVal, newVal) {
						if(oldVal === newVal)
							return;

						remaining += oldVal;

						if(newVal > remaining)
							newVal = remaining;

						remaining -= remaining;

						stat.initial = newVal;
						this.value(newVal);
					}).value(this.settings.minStat);
					return;
				case 1:
					new HTMLStatElement(elmt, -6, 6, 3).change(function (oldVal, newVal) {
						if(oldVal === newVal)
							return;

						stat.bonus = newVal;
						this.value(newVal);
					}).value(0);
					return;
				case 2:
					elmt.createEl("i", { text: Math.floor((stat.initial + stat.bonus) / 2) });
					return;
				case 3:
					elmt.createEl("i", { text: Math.floor((stat.initial + stat.bonus) / 5) });
					return;
				default:
					return;
			}
		});

		new Setting(contentEl).addButton(btn => btn.setButtonText('Créer').onClick(console.log));
	}

	async onClose(): void {

	}

	group(elmt: HTMLElement, title: string, collapsed: boolean = false): HTMLDivElement
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

		if(collapsed)
			titleDiv.parentElement.classList.toggle("character-builder-group-collapsed");

		return container.createDiv({cls: "character-builder-group-content"});
	}

	table(elmt: HTMLElement, header: string[], descriptors: string[], cb: (elmt: HTMLElement, col: number, row: number) => void): HTMLElement
	{
		const table = elmt.createEl("table", { cls: "character-builder-table" });
		const th = table.createEl("thead").createEl("tr", { cls: ["character-builder-table-row", "character-builder-table-head"] });
		const tbody = table.createEl("tbody");

		th.createEl("th", { cls: "character-builder-table-header" });

		for(let j = 0; j < header.length; j++)
			th.createEl("th", { cls: "character-builder-table-header", text: header[j] });

		for(let i = 0; i < descriptors.length; i++)
		{
			const tr = tbody.createEl("tr", { cls: "character-builder-table-row" });
			tr.createEl("td", { cls: "character-builder-table-descriptor", text: descriptors[i] });
			for(let j = 0; j < header.length; j++)
				cb(tr.createEl("td", { cls: "character-builder-table-cell" }), j, i);
		}

		return table;
	}
}

class CharacterBuilderSettingTab extends PluginSettingTab {
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

abstract class VisualComponent {
	setting: Setting;
	hasDynamicDescription: boolean;
	constructor(parent: HTMLElement, name: string, hasDynamicDescription: boolean = true)
	{
		this.setting = new Setting(parent).setName(name);
		this.hasDynamicDescription = hasDynamicDescription;
		this.linkedProperty = undefined;
		this.onChange(value => {});
	}
	disable(state: boolean): VisualComponent
	{
		this.setting.setDisabled(state);

		return this;
	}
	desc(desc: string): VisualComponent
	{
		this.setting.setDesc(desc);

		return this;
	}

	abstract value(value: string): VisualComponent;
	abstract onChange(cb): VisualComponent;
}
class Dropdown extends VisualComponent {
	dropdown: DropdownComponent;
	src: string;
	dataSource: any;
	cache: any;
	linkedProperty?: string;
	constructor(parent: HTMLElement, name: string, hasDynamicDescription: boolean = true)
	{
		super(parent, name, hasDynamicDescription);
		this.setting.addDropdown(drop => this.dropdown = drop);
		this.onChange(value => {});
	}
	value(value: string): Dropdown
	{
		this.dropdown.setValue(value);
		this.setting.setDesc("");
		this.dropdown.changeCallback(value);

		return this;
	}
	link(propertyName?: string): Dropdown
	{
		this.linkedProperty = propertyName;

		if(this.dataSource && this.linkedProperty)
			this.value(this.dataSource[this.linkedProperty]);

		return this;
	}
	source(dataSrc: any, src: string): Dropdown
	{
		if(src === this.src)
			return this;

		this.dataSource = dataSrc;
		this.src = src;

		return this.update();
	}
	update(): Dropdown
	{
		let i, L = this.dropdown.selectEl.options.length - 1;
		for(i = L; i >= 0; i--)
			this.dropdown.selectEl.remove(i);

		let match, target = this.src;
		while((match = /{(.+?)}/g.exec(target)) !== null)
			target = target.replace(match[0], this.dataSource[match[1]]);
		this.cache = CharacterBuilderCache.cache(target);

		if(!this.src || !this.cache)
		{
			return this.value("").disable(true);
		}
		else
		{
			this.disable(false);
		}

		const keys = Object.keys(this.cache);

		for(i = 0; i < keys.length; i++)
			this.dropdown.addOption(keys[i], keys[i]);

		return this.value("");
	}
	onChange(cb): Dropdown
	{
		this.dropdown?.onChange(value => {
			if(this.hasDynamicDescription)
				this._changeDesc(value);

			if(this.linkedProperty !== undefined)
				this.dataSource[this.linkedProperty] = value;

			cb(value);
		});

		return this;
	}
	private _changeDesc(value): void
	{
		this.setting.setDesc("");
		if(value === undefined || value === "")
			return;
		else if(this.cache[value].hasOwnProperty("content"))
			MarkdownPreviewView.renderMarkdown(this.cache[value].content, this.setting.descEl);
		else
			MarkdownPreviewView.renderMarkdown(this.cache[value], this.setting.descEl);
	}
}
class TextField extends VisualComponent {
	text: TextComponent;
	dataSource: any;
	linkedProperty?: string;
	constructor(parent: HTMLElement, name: string, hasDynamicDescription: boolean = true)
	{
		super(parent, name, hasDynamicDescription);
		this.setting.addText(text => this.text = text);
		this.onChange(value => {});
	}
	value(value: string): TextField
	{
		this.text.setValue(value);
		this.setting.setDesc("");
		this.text.changeCallback(value);

		return this;
	}
	link(dataSrc: any, propertyName?: string): Dropdown
	{
		this.dataSource = dataSrc;
		this.linkedProperty = propertyName;

		if(this.dataSource && this.linkedProperty)
			this.value(this.dataSource[this.linkedProperty]);

		return this;
	}
	onChange(cb): TextField
	{
		this.text?.onChange(value => {
			if(this.dataSource && this.linkedProperty)
				this.dataSource[this.linkedProperty] = value;

			cb(value);
		});

		return this;
	}
}
class HTMLStatElement {
	val: number;
	component: HTMLElement;
	cb: (oldVal: number, newVal: number) => void;
	constructor(parent: HTMLElement, min?: number, max?: number, step: number = 1)
	{
		this.component = parent.createEl("input", { type: "number", cls: "character-builder-stat-input", attr: { min: min, max: max, step: step } });
		this.component.addEventListener("change", this._onChange.bind(this));
	}
	value(value: number): HTMLStatElement
	{
		if(this.val != value)
		{
			this.component.valueAsNumber = value;
			this.val = value;
			this.component.dispatchEvent(new Event("change", { bubbles: true }));
		}
		return this;
	}
	change(cb: (oldVal: number, newVal: number) => void): HTMLStatElement
	{
		this.cb = cb;
		return this;
	}
	private _onChange()
	{
		this.cb && this.cb(this.val, this.component.valueAsNumber);
	}
}