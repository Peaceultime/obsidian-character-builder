export const VIEW_TYPE_CHARACTER_BUILDER_FULL = "character-builder-full-view";

import { ItemView, Setting, Notice } from 'obsidian';

import { CharacterBuilderCache as Cache } from 'src/cache.ts';
import { CharacterBuilderSettings as Settings } from 'src/settings.ts';
import { Dropdown, TextField, Slider } from 'src/components.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';
import { print } from 'src/builder.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';

export class CharacterBuilderFullView extends ItemView {
	metadata: Metadata;
	settings: Settings;
	path?: string;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_CHARACTER_BUILDER_FULL;
	}

	getDisplayText(): string {
		return `Création de personnage`;
	}

	async onOpen(): void {
		await this.openData();
	}

	async openData(file: TFile): void {
		if(file)
		{
			this.path = file.filepath;
			this.metadata = this.app.metadataCache.getFileCache(file).frontmatter;
		}
		else
		{
			this.metadata = {};
			this.metadata.type = "character";
			this.metadata.statBlock = Object.assign({}, StatBlock);
			this.metadata.substats = {};
		}

		const settings = Cache.cache("settings");
		let splitElmt;
		const {contentEl} = this;

		contentEl.empty();

		contentEl.createEl("h2", { text: "Création de personnage" });

		splitElmt = contentEl.createDiv({ cls: "character-builder-splitter-container" });
		new TextField(splitElmt, "Nom de personnage").link(this.metadata, "name");
		const settingDropdown = new Dropdown(splitElmt, "Univers", false).source(this.metadata, `races`).link(this.metadata, "setting");

		const raceGroup = this.group(contentEl, "Race du personnage", true);
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

		const splitContainer = contentEl.createDiv({ cls: "character-builder-splitter-container" });
		const statBlockContainer = splitContainer.createDiv({ cls: "character-builder-statblock-container" });

		const stats = Object.keys(this.metadata.statBlock);
		let totalElmt;
		this.remaining = parseInt(settings.statAmount);
		this.table(statBlockContainer, Object.values(StatBlockNames), ["Statistique", "Bonus racial", "Réussite normale", "Réussite haute", "Réussite extrème"], (elmt, col, row) => {
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
							this.component.parentElement.parentElement.parentElement.children[2].children[col + 1].textContent = stat.initial + stat.bonus;
							this.component.parentElement.parentElement.parentElement.children[3].children[col + 1].textContent = Math.floor((stat.initial + stat.bonus) / 2);
							this.component.parentElement.parentElement.parentElement.children[4].children[col + 1].textContent = Math.floor((stat.initial + stat.bonus) / 5);
							totalElmt.textContent = self.remaining;
						} catch(e) {}

						return newVal;
					}).value(stat.initial || settings.minStat);
					return;
				case 1:
					new HTMLStatElement(elmt, -6, 6, 3).change(function (oldVal, newVal) {
						if(oldVal === newVal)
							return;

						stat.bonus = newVal;

						try {
							this.component.parentElement.parentElement.parentElement.children[2].children[col + 1].textContent = stat.initial + stat.bonus;
							this.component.parentElement.parentElement.parentElement.children[3].children[col + 1].textContent = Math.floor((stat.initial + stat.bonus) / 2);
							this.component.parentElement.parentElement.parentElement.children[4].children[col + 1].textContent = Math.floor((stat.initial + stat.bonus) / 5);
						} catch(e) {}
					}).value(stat.bonus || 0);
					return;
				case 2:
					elmt.createEl("i", { text: stat.initial + stat.bonus });
					return;
				case 3:
					elmt.createEl("i", { text: Math.floor((stat.initial + stat.bonus) / 2) });
					return;
				case 4:
					elmt.createEl("i", { text: Math.floor((stat.initial + stat.bonus) / 5) });
					return;
				default:
					return;
			}
		});
		const totalContainer = statBlockContainer.createDiv({ cls: 'character-builder-total-stats' });
		totalContainer.createEl("span", { text: 'Restant: ' });
		totalElmt = totalContainer.createEl("strong", { text: this.remaining });

		splitElmt = splitContainer.createDiv();
		const armorSlider = new Slider(splitElmt, `Armure max`).desc(`L'armure maximum determine le nombre de talents disponibles au niveau 1.`).range(2, 6, 2);
		const talentText = new TextField(splitElmt).name(`Talents au niveau 1`).disable(true).value(this.metadata.talents).class("text-field-no-editor");
		armorSlider.onChange(value => {
			this.metadata.armor = value;
			this.metadata.talents = 6 - value / 2;

			talentText.value(6 - value / 2);
		}).value(2).tooltip(true);

		new Setting(contentEl).addButton(btn => btn.setButtonText(this.path ? 'Modifier' : 'Créer').onClick(this.create.bind(this)));
	}

	async onClose(): void {

	}

	async create(): void {
		const settings = Cache.cache("settings");
		const filepath = `${settings.charactersFolder}/${this.metadata.name}.md`;
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
		if(!await this.app.vault.adapter.exists(filepath))
		{
			const content = `---\n${JSON.stringify(this.metadata)}\n---\n${print(this.metadata, templateData)}`;
			const file = await this.app.vault.create(filepath, content);
			const leaf = this.app.workspace.getLeaf();
			await leaf.openFile(file);
		}
		else
		{
			new Notice("Le fichier existe déjà.");
			return;
		}
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
