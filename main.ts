import { App, Editor, MarkdownPreviewView, ItemView, WorkspaceLeaf, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface CharacterBuilderSettings {
	characters: string;
	races: string;
	talents: string;
}

const DEFAULT_SETTINGS: CharacterBuilderSettings = {
	characters: '99. Personnages',
	races: '3. Races/Liste des races',
	talents: '2. Classes/2. Talents'
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
		this.addRibbonIcon('calculator', 'Créer un nouveau personnage', async (evt: MouseEvent) => {
			const leaf = this.app.workspace.getLeaf();
			await leaf.setViewState({ type: VIEW_TYPE_CHARACTER_BUILDER_FULL, active: true, });
			this.app.workspace.revealLeaf(leaf);
		});

		this.addRibbonIcon('dice', 'Créer un nouveau personnage depuis les modèles', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new CharacterBuilderModal(this.app).open();
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
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

		const races = (await Promise.all(files.filter(e => e.path.startsWith(this.settings.races + "/")).map(this.getRaceContent.bind(this)))).filter(e => !!e && !!e.content);

		const groups = races.reduce((p, v) => { if(!p.includes(v.parent)) p.push(v.parent); return p; }, []);

		for(let i = 0; i < groups.length; i++)
		{
			const r = races.filter(e => e.parent === groups[i]);

			CharacterBuilderCache.cache(`races/${groups[i]}/content`, r.reduce((p, v) => { p[v.name] = v; return p; }, {}));
		}

		/*const talents = files.filter(e => e.path.includes("2. Talents")).map(this.getMetadata.bind(this));
		CharacterBuilderCache.cache("talents/metadata", talents.reduce((p, v) => { p[v.name] = v; return p; }, {}));*/
	}

	async getRaceContent(file: TFile): any {
		const metadata = app.metadataCache.getFileCache(file);

        if(!metadata.hasOwnProperty("headings") || !metadata.hasOwnProperty("sections"))
            return;
        
        const content = await this.app.vault.cachedRead(this.app.vault.getAbstractFileByPath(file.path));
        const desc = content.substring(0, metadata.headings[2].position.start.offset - 1);
        const subraces = metadata.headings.slice(0, metadata.headings.findIndex(e => e.heading.startsWith("BONUS RACIA"))).map((e, i) => i).slice(3).map(e => metadata.headings[e].heading).reduce((p, v) => {
        	p[v] = this.contentOfHeading(metadata, content, v, true); return p;
        }, {});
        
        return { subraces: subraces, content: desc, name: file.basename, parent: file.parent.name, path: file.path };
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

		contentEl.empty();

		contentEl.createEl("h2", { text: "Création de personnage" });

		new Setting(contentEl)
			.setName("Nom de personnage")
			.addText(text => text.onChange(value => this.char_name = value).setValue(this.char_name));

		const settingDropdown = new Dropdown(contentEl, "Univers", `races`, this, false);
		const raceGroup = this.group(contentEl, "Race du personnage");
		const raceDropdown = new Dropdown(raceGroup, "Race", `races/{setting}/content`, this);
		const subraceDropdown = new Dropdown(raceGroup, "Sous-race", `races/{setting}/content/{race}/subraces`, this);
		const featureDropdown = new Dropdown(raceGroup, "Bonus racial", `races/{setting}/content/{race}/feature`, this);

		settingDropdown.onChange(value => {
			this.setting = value;
			raceDropdown.update();
			subraceDropdown.update();
			featureDropdown.update();
		});

		raceDropdown.onChange(value => {
			this.race = value;
			subraceDropdown.update();
			featureDropdown.update();
		});

		subraceDropdown.onChange(value => this.subrace = value);
		featureDropdown.onChange(value => this.feature = value);
		
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

		new Setting(containerEl).setName('Dossier des personnages').addText(text => text.setValue(this.plugin.settings.folder).onChange(async (value) => {
			this.plugin.settings.folder = value;
		}));

		new Setting(containerEl).setName('Dossier des races').addText(text => text.setValue(this.plugin.settings.races).onChange(async (value) => { 
			this.plugin.settings.races = value;
		}));

		new Setting(containerEl).setName('Dossier des talents').addText(text => text.setValue(this.plugin.settings.talents).onChange(async (value) => {
			this.plugin.settings.talents = value;
		}));
	}

	hide()
	{
		await this.plugin.saveSettings();
		super.hide();
	}
}

class Dropdown {
	static regex: RegExp = /{(.+?)}/g;
	setting: Setting;
	dropdown: DropdownComponent;
	src: string;
	dataSource: any;
	cache: any;
	hasDynamicDescription: boolean;
	constructor(parent: HTMLElement, name: string, src: string, dataSource: any, hasDynamicDescription: boolean = true)
	{
		this.setting = new Setting(parent).setName(name).addDropdown(drop => this.dropdown = drop);
		this.hasDynamicDescription = hasDynamicDescription;
		this.dataSource = dataSource;
		this.onChange(value => {}).source(src);
	}
	value(value: string): Dropdown
	{
		this.dropdown.setValue(value);
		this.setting.setDesc("");
		this.dropdown.changeCallback(value);

		return this;
	}
	source(src: string): Dropdown
	{
		if(src === this.src)
			return this;

		this.src = src;
		return this.update();
	}
	update(): Dropdown
	{
		let i, L = this.dropdown.selectEl.options.length - 1;
		for(i = L; i >= 0; i--)
			this.dropdown.selectEl.remove(i);

		let match, target = this.src;
		while((match = Dropdown.regex.exec(target)) !== null)
			target = target.replace(match[0], this.dataSource[match[1]]);
		this.cache = CharacterBuilderCache.cache(target);

		if(!this.src || !this.cache)
		{
			this.value("");
			this.dropdown.setDisabled(true);
			return this;
		}
		else
		{
			this.dropdown.setDisabled(false);
		}

		const keys = Object.keys(this.cache);

		for(i = 0; i < keys.length; i++)
			this.dropdown.addOption(keys[i], keys[i]);

		return this.value("");
	}
	onChange(cb): Dropdown
	{
		this.dropdown.onChange(value => {
			if(this.hasDynamicDescription)
				this._changeDesc(value);

			cb(value);
		});

		return this;
	}
	private _changeDesc(value): void
	{
		this.setting.setDesc("");
		if(value === "")
			return;
		else if(this.cache[value].hasOwnProperty("content"))
			MarkdownPreviewView.renderMarkdown(this.cache[value].content, this.setting.descEl);
		else
			MarkdownPreviewView.renderMarkdown(this.cache[value], this.setting.descEl);
	}
}