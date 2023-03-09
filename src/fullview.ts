export const VIEW_TYPE_CHARACTER_BUILDER_FULL = "character-builder-full-view";

import { ItemView, Setting, Notice } from 'obsidian';

import { CharacterBuilderCache as Cache } from 'src/cache.ts';
import { CharacterBuilderSettings as Settings } from 'src/settings.ts';
import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';
import { print } from 'src/builder.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';

export class CharacterBuilderFullView extends ItemView {
	plugin: any;
	metadata: Metadata;
	file: TFile;

	constructor(leaf: WorkspaceLeaf, plugin: any) {
		super(leaf);
		this.plugin = plugin;
		this.navigation = true;
	}

	getViewType(): string {
		return VIEW_TYPE_CHARACTER_BUILDER_FULL;
	}

	getDisplayText(): string {
		return `${!!this.file ? 'Modification' : 'Création'} de ${this.metadata?.name || 'personnage'} - ${this.contentEl.querySelector(".character-builder-breadcrumb-tab:not(.tab-hidden)")?.children[0]?.textContent || 'Base du personnage'}`;
	}

	async onOpen(): void {
		const {contentEl} = this;

		contentEl.empty();
		const loading = contentEl.createDiv({ cls: "character-builder-loading-container" });
		loading.createSpan({ cls: "character-builder-loading-title" });
		loading.createSpan({ cls: "character-builder-loading-bar" });

		this.plugin.loading.then(this.openData.bind(this));
	}

	async openData(file: TFile): void {
		if(file)
		{
			this.file = file;
			this.metadata = this.app.metadataCache.getFileCache(file).frontmatter;
			this.metadata.position = undefined;
		}
		else
		{
			this.metadata = {};
			this.metadata.statBlock = Object.assign({}, StatBlock);
			this.metadata.substats = {};
		}
		this.metadata.type = "character";

		this.refreshRender();
	}

	async refreshRender()
	{
		const settings = Cache.cache("settings");
		let splitElmt;
		const {contentEl} = this;

		contentEl.empty();

		contentEl.createEl("h2", { text: "Création de personnage" });
		const breadcrumb = contentEl.createDiv({ cls: "character-builder-breadcrumb-container" });
		const tabContainer = contentEl.createDiv({ cls: "character-builder-tab-container" });

		const baseTab = this.tab(breadcrumb, tabContainer, "Base du personnage", true, () => this.updateDisplay());

		splitElmt = baseTab.createDiv({ cls: "character-builder-splitter-container" });
		new TextField(splitElmt, "Nom de personnage").link(this.metadata, "name").onChange(value => this.updateDisplay());
		const settingDropdown = new Dropdown(splitElmt, "Univers", false).source(this.metadata, `races`).link(this.metadata, "setting");

		const splitContainer = baseTab.createDiv({ cls: "character-builder-splitter-container" });
		const statBlockContainer = splitContainer.createDiv({ cls: "character-builder-statblock-container" });

		const stats = Object.keys(this.metadata.statBlock);
		let totalElmt;
		this.remaining = parseInt(settings.statAmount);
		this.table(statBlockContainer, Object.values(StatBlockNames), ["Statistique", "Réussite normale", "Réussite haute", "Réussite extrème"], (elmt, col, row) => {
			const stat = this.metadata.statBlock[stats[col]];
			const self = this;
			switch(row)
			{
				case 0:
					new HTMLStatElement(elmt, settings.minStat, settings.maxInitialStat).change(function(oldVal, newVal) {
						if(oldVal === newVal)
							return;

						if(oldVal !== undefined)
							self.remaining += oldVal;

						if(newVal > self.remaining)
						{
							newVal = self.remaining;
							self.remaining = 0;
						}
						else
						{
							self.remaining -= newVal;
						}

						stat.initial = newVal;

						try {
							this.component.parentElement.parentElement.parentElement.children[1].children[col + 1].textContent = stat.initial + stat.bonus;
							this.component.parentElement.parentElement.parentElement.children[2].children[col + 1].textContent = Math.floor((stat.initial + stat.bonus) / 2);
							this.component.parentElement.parentElement.parentElement.children[3].children[col + 1].textContent = Math.floor((stat.initial + stat.bonus) / 5);
							totalElmt.textContent = self.remaining;
						} catch(e) {}

						return newVal;
					}).value(stat.initial || settings.minStat);
					return;
				case 1:
					elmt.createEl("i", { text: stat.initial + stat.bonus });
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
		const totalContainer = statBlockContainer.createDiv({ cls: 'character-builder-total-stats' });
		totalContainer.createEl("span", { text: 'Restant: ' });
		totalElmt = totalContainer.createEl("strong", { text: this.remaining?.toString() });

		splitElmt = splitContainer.createDiv();
		const armorSlider = new Slider(splitElmt, `Armure max`).desc(`L'armure maximum determine le nombre de talents disponibles au niveau 1.`).range(2, 6, 2);
		const talentText = new TextField(splitElmt, `Talents au niveau 1`).disable(true).value(this.metadata.talents).class("text-field-no-editor");
		armorSlider.onChange(value => {
			this.metadata.armor = value;
			this.metadata.talents = 6 - value / 2;

			talentText.value(6 - value / 2);
		}).value(2).tooltip(true);

		new TextArea(baseTab, `Backstory`).link(this.metadata, `flavoring`);

		const raceTab = this.tab(breadcrumb, tabContainer, "Race", false, () => this.updateDisplay());

		const raceGroup = this.group(raceTab, "Race du personnage");
		const raceDropdown = new Dropdown(raceGroup, "Race").source(this.metadata, `races/{setting}/content`).link(this.metadata, "race");
		splitElmt = raceGroup.createDiv({ cls: "character-builder-splitter-container" });
		const subraceDropdown = new Dropdown(splitElmt, "Sous-race").source(this.metadata, `races/{setting}/content/{race}/subraces`).link(this.metadata, "subrace");
		const featureDropdown = new Dropdown(splitElmt, "Bonus racial").source(this.metadata, `races/{setting}/content/{race}/features`).link(this.metadata, "feature");

		settingDropdown.onChange(value => {
			raceDropdown.update();
			subraceDropdown.update();
			featureDropdown.update();
		});
		raceDropdown.onChange(value => {
			subraceDropdown.update();
			featureDropdown.update();
		});

		const levelsTab = this.tab(breadcrumb, tabContainer, "Niveaux", false, () => this.updateDisplay());


		new Setting(contentEl).addButton(btn => btn.setButtonText("Suivant").onClick(e => {
			const currentBreadcrumb = breadcrumb.querySelector(".character-builder-breadcrumb-tab:not(.tab-hidden)");
			const idx = [...breadcrumb.children].findIndex(e => e === currentBreadcrumb);

			if(idx === -1 || idx + 1 === breadcrumb.children.length)
				return;


			for(let i = 0; i < statBlockContainer.children.length; i++)
				tabContainer.children[i].classList.add("tab-hidden");
			for(let i = 0; i < breadcrumb.children.length; i++)
				breadcrumb.children[i].classList.add("tab-hidden");
			tabContainer.children[idx+1].classList.remove("tab-hidden");
			breadcrumb.children[idx+1].classList.remove("tab-hidden");

			this.updateDisplay();
		})).addButton(btn => btn.setButtonText(this.file ? 'Modifier' : 'Créer').onClick(() => {
			if(this.metadata.name.trim() === '')
			{
				new Notice("Veuillez saisir un nom pour créer la fiche de personnage.");
				return;
			}

			this.create();
		}));

		this.updateDisplay();
	}

	updateDisplay(): void {
		this.app.workspace.updateTitle();
		this.leaf.updateHeader();
		this.titleEl.setText(this.getDisplayText());
	}

	async onClose(): void {

	}

	async create(): void {
		const settings = Cache.cache("settings");
		const filepath = `${this.file ? this.file.parent.path : settings.charactersFolder}/${this.metadata.name}.md`;
		let templateData;
		try {
			templateData = await this.app.vault.read(this.app.vault.getAbstractFileByPath(settings.characterTemplate));
		} catch(e) {
			new Notice("Le template est introuvable.");
			return;
		}
		if(!templateData)
		{
			new Notice("Le template est introuvable.");
			return;
		}

		console.log(this.file);

		if(await this.app.vault.adapter.exists(filepath) && this.file && this.file.path !== filepath)
		{
			new Notice("Ce fichier existe déjà");
			return;
		}

		const content = `---\n${JSON.stringify(this.metadata)}\n---\n${print(this.metadata, templateData)}`;

		let file;
		if(this.file && this.file.basename !== this.metadata.name)
		{
			await this.app.vault.delete(this.file);
			file = await this.app.vault.create(filepath, content);
		}
		else if(this.file)
		{
			await this.app.vault.modify(this.file, content);
			file = this.file;
		}
		else if(!this.file)
		{
			file = await this.app.vault.create(filepath, content);
		}

		await this.leaf.openFile(file);
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

	tab(breadcrumb: HTMLElement, elmt: HTMLElement, title: string, active: boolean = false, cb?: () => void = undefined): HTMLDivElement
	{
		const tab = elmt.createDiv({ cls: ["character-builder-tab", "tab-hidden"] });
		const titleElmt = breadcrumb.createDiv({ cls: ["character-builder-breadcrumb-tab", "tab-hidden"] }).createSpan({ text: title, cls: "character-builder-breadcrumb-tab-title" });
		titleElmt.addEventListener("click", () => {
			for(let i = 0; i < elmt.children.length; i++)
				elmt.children[i].classList.add("tab-hidden");
			for(let i = 0; i < breadcrumb.children.length; i++)
				breadcrumb.children[i].classList.add("tab-hidden");
			tab.classList.remove("tab-hidden");
			titleElmt.parentElement.classList.remove("tab-hidden");

			cb && cb();
		});

		if(active)
		{
			for(let i = 0; i < elmt.children.length; i++)
				elmt.children[i].classList.add("tab-hidden");
			for(let i = 0; i < breadcrumb.children.length; i++)
				breadcrumb.children[i].classList.add("tab-hidden");
			tab.classList.remove("tab-hidden");
			titleElmt.parentElement.classList.remove("tab-hidden");
		}

		return tab;
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
