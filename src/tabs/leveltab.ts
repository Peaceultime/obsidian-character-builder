import { Setting, MarkdownPreviewView, Modal, App, ButtonComponent, Menu, HoverPopover, TextComponent } from 'obsidian';
import { Dropdown, TextField, TextArea, Slider, MarkdownArea } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata, TalentMetadata, Talent } from 'src/metadata.ts';
import { HTMLStatElement, StatBlockElement, SubstatPicker } from 'src/htmlelements.ts';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';
import { confirm as Confirm, ConfirmModalOptions } from 'src/modals.ts';

export class LevelTab extends Tab
{
	talents: Talent[];
	levels: Level[];

	talentPicker: TalentPicker;

	talentLists: TalentList[];

	statblocks: StatBlockElement[];
	substats: SubstatPicker[];
	hps: Slider[];
	focuses: Slider[];

	levelStats: StatBlock[];
	render(): void
	{
		const metadata = this.metadata = this.request("metadata");

		this.content.empty();
		this.requiredList = [];

		this.talents = [];
		this.talentLists = [];
		this.statblocks = [];
		this.substats = [];
		this.hps = [];
		this.focuses = [];
		this.levelStats = metadata.levels.map(e => { return {}; });

		this.levels = metadata.levels;

		const levelUpBtn = new Setting(this.content).setName(`Ajouter le niveau ${this.levels.reduce((p, v) => Math.max(p, v.level), 0) + 1}`).addButton(btn => btn.setIcon("lucide-plus-circle").onClick((e) => {
			const level = {
				level: this.levels.reduce((p, v) => Math.max(p, v.level), 0) + 1,
				talents: [],
				buffedStat: undefined,
				buffedSubstats: {},
				hp: 0,
				focus: Cache.cache("settings/pointsForHpFocus"),
				flavoring: undefined,
			};
			metadata.levels.push(level);
			this.levelStats.push({});
			this.computeStats();
			this.renderLevel(level);
			levelUpBtn.setName(`Ajouter le niveau ${this.levels.reduce((p, v) => Math.max(p, v.level), 0) + 1}`);
		}));

		if(metadata.levels.length === 0)
		{
			metadata.levels.push({
				level: 1,
				talents: [],
				buffedStat: undefined,
				buffedSubstats: {},
				hp: 0,
				focus: Cache.cache("settings/pointsForHpFocus"),
				flavoring: undefined,
			});
			this.levelStats.push({});
		}
		this.talentPicker = new TalentPicker(this.container.app);
		
		this.computeStats();
		for(let i = 0; i < this.levels.length; i++)
		{
			this.talents.push(...this.levels[i].talents);
			this.renderLevel(this.levels[i], this.levels.length - 1 !== i);
		}
	}
	renderLevel(level: Level, collapsed: boolean = false)
	{
		const grpEl = group(this.content, `Niveau ${level.level}`, collapsed);

		grpEl.createDiv("character-builder-splitter-container", split => {
			split.createDiv(undefined, div => {
				const pointsForHpFocus = Cache.cache("settings/pointsForHpFocus");
				const maxHp = Math.min(pointsForHpFocus, Math.floor(4 + (this.levelStats[level.level - 1].constitution * 2 + this.levelStats[level.level - 1].will) / 30));

				const hp = new Slider(div, "PV", false).range(0, maxHp, 1).link(level, "hp");
				const focus = new Slider(div, "Focus", false).range(pointsForHpFocus - maxHp, pointsForHpFocus, 1).link(level, "focus").desc(pointsForHpFocus + " points à repartir entre PV et focus.");

				hp.onChange((value) => { focus.value(pointsForHpFocus - value); this.updateSliderTooltips(); });
				focus.onChange((value) => { hp.value(pointsForHpFocus - value); this.updateSliderTooltips(); });

				this.hps.push(hp);
				this.focuses.push(focus);

				if(level.level % 2 === 0)
				{
					this.statblocks.push(new StatBlockElement(div, this.metadata, {
						hasEvenLevelPicker: level.level,
						hasTotalRow: true,
						maxStat: Cache.cache("settings/maxStat"),
					}).onChange(() => this.update()));
				}
			})
		
			split.createDiv(undefined, div => {
				const talentList = new TalentList(app, div, level.level === 1 ? [...level.talents, 
					...Cache.cache(`races/${this.metadata.setting}/content/${this.metadata.race.name}/subraces/${this.metadata.race.subname}/talents`) ?? [], 
					...Cache.cache(`races/${this.metadata.setting}/content/${this.metadata.race.name}/features/${this.metadata.race.feature}/talents`) ?? []
				] : level.talents);
				this.talentLists.push(talentList);
				talentList.onRemove(async (talent: Talent) => {
					try {
						await Confirm(app, {yesText: "Confirmer", noText: "Annuler", content: createSpan({text: "Voulez vous vraiment supprimer ce talent, et tous les talents qui en dépendent ?"})});
						this.removeDependencies(talent, level);
						return true;
					} catch(e) {
						return false;
					}
				}).onAddButton(() => this.pickTalent(talentList, level));
				this.substats.push(new SubstatPicker(group(div, `Stats secondaires`, true), this.metadata, {
					statAmount: level.level === 1 ? Cache.cache("settings/substatFirstLevel") : Cache.cache("settings/substatPerLevel"),

					hasWholeBonus: true,
					hasTotal: true,
					hasStatPicker: true,
					hasValuePicker: true,

					showRemaining: !this.metadata.freeMode,

					level: level.level,
				}).onChange(() => this.update()));
			});
		});
		new MarkdownArea(group(grpEl, `Flavoring`, true)).link(level, `flavoring`);

		this.update();
	}
	removeDependencies(talent: Talent, level: Level)
	{
		level.talents.splice(level.talents.findIndex(e => TalentMetadata.compare(e, talent)), 1);

		const currentTalents = [];
		let count = 0;
		for(let i = 0; i < this.metadata.levels.length; i++)
		{
			const currentLevel = this.metadata.levels[i];
			for(let j = 0; j < currentLevel.talents.length; j++)
			{
				const tal = currentLevel.talents[j];
				if(!TalentPicker.available(Cache.cache(`talents/registry/${tal.name}`), currentTalents, currentLevel, this.levelStats))
				{
					currentLevel.talents.splice(j, 1);
					this.talentLists[i].remove(tal, true);
					count++;
				}
				else
					currentTalents.push(tal);
			}
		}

		if(count > 0)
			new Notice(`${count} talents dépendant de ${talent.name} ont été supprimés.`);

		this.talents = currentTalents;
	}
	pickTalent(talentList: TalentList, level: Level)
	{
		const metadata = this.request("metadata");

		if(!this.metadata.freeMode && level.level === 1 && level.talents.length >= (6 - metadata.armor))
			return new Notice("Vous avez déjà choisi tous vos talents pour ce niveau");
		else if(!this.metadata.freeMode && level.level > 1 && level.talents.length >= 1)
			return new Notice("Vous avez déjà choisi tous vos talents pour ce niveau");

		this.talentPicker.pick(this.talents, level.level, this.levelStats[level.level - 1], this.metadata).then(talent => {
			this.talents.push(talent);
			level.talents.push(talent);
			talentList.add(talent);
		}).catch(err => err && console.error(err));
	}
	computeStats()
	{
		if(!this.levelStats.length)
			return;

		for(let stat of Object.keys(this.metadata.statBlock))
		{
			this.levelStats[0][stat] = this.metadata.statBlock[stat].initial + this.metadata.statBlock[stat].bonus;	
		}

		for(let i = 1; i < this.metadata.levels.length; i++)
		{
			for(let stat of Object.keys(this.metadata.statBlock))
				this.levelStats[i][stat] = this.levelStats[i - 1][stat] + (this.metadata.levels.find(e => e.level === i + 1)?.buffedStat === stat ? 3 : 0);
		}
	}
	update()
	{
		this.computeStats();
		this.updateSliderTooltips();

		for(let i = 0; i < this.statblocks.length; i++)
		{
			this.statblocks[i].options.maxStat = this.metadata.freeMode ? 1000 : Cache.cache("settings").maxStat;
			this.statblocks[i].update();
		}

		for(let i = 0; i < this.substats.length; i++)
			this.substats[i].update();
	}
	updateSliderTooltips()
	{
		let hp = Cache.cache(`races/${this.metadata.setting}/content/${this.metadata.race.name}/health`), focus = 0;

		for(let i = 0; i < this.hps.length; i++)
		{
			const pointsForHpFocus = Cache.cache("settings/pointsForHpFocus");
			const maxHp = Math.min(pointsForHpFocus, Math.floor(4 + (this.levelStats[i].constitution * 2 + this.levelStats[i].will) / 30));

			hp += this.hps[i].component.getValue();
			this.hps[i].tooltip(hp);
			this.hps[i].range(0, maxHp, 1);

			focus += this.focuses[i].component.getValue();
			this.focuses[i].tooltip(focus);
			this.focuses[i].range(pointsForHpFocus - maxHp, pointsForHpFocus, 1);
		}
	}
}

class TalentList
{
	app: App;

	container: HTMLElement;
	content: HTMLElement;

	talents: Talent[];
	talentsEl: HTMLElement[];
	addCb: () => void;
	removeCb: (talent: Talent) => Promise<boolean>;

	hoverPopover: HoverPopover; //Active popover

	constructor(app: App, parent: HTMLElement, talents: Talent[])
	{
		this.app = app;
		this.container = parent.createDiv();
		this.container.createEl("h5", { cls: "character-builder-talents-title", text: "Talents" });
		this.container.createDiv("character-builder-talents-container", div => {
			new ButtonComponent(div).setIcon("lucide-plus").onClick(() => this.addCb && this.addCb());
			this.content = div.createDiv("character-builder-talents-content");
		});
		this.talents = [];
		this.talentsEl = [];

		for(let i = 0; i < talents.length; i++)
			this.add(talents[i]);
	}
	add(talent: Talent): void
	{
		const elmt = this.content.createDiv({ cls: talent.readonly ? "character-builder-talent talent-readonly" : "character-builder-talent", text: TalentMetadata.text(talent) }, (div) => talent.readonly ? undefined : div.createSpan("character-builder-talent-remove").addEventListener("click", () => this.remove(talent)));
		elmt.addEventListener("mouseover", () => this.onTalentHover(talent));

		this.talents.push(talent);
		this.talentsEl.push(elmt);
	}
	async onTalentHover(talent: Talent): void
	{
		const popover = new HoverPopover(this, this.talentsEl[this.talents.findIndex(e => e.name === talent.name && e.subname === talent.subname)]);
		const metadata = Cache.cache(`talents/registry/${talent.name}`);
		const content = this.app.embedRegistry.getEmbedCreator(metadata.file)({
			app: this.app,
			linktext: null,
			sourcePath: null,
			containerEl: popover.hoverEl.createDiv(),
			displayMode: true,
			showInline: false,
			depth: 0
		}, metadata.file);
		await content.loadFile();

		const child = content.containerEl.firstChild;
		child.remove();
		content.containerEl.createDiv("markdown-embed-content").appendChild(child);
	}
	onAddButton(cb: () => void): TalentList
	{
		this.addCb = cb;

		return this;
	}
	async remove(talent: Talent, silent: boolean = false): void
	{
		const remove = !silent && this.removeCb && (await this.removeCb(talent));

		if((silent || remove) && TalentMetadata.includes(this.talents, talent))
		{
			const idx = this.talents.findIndex(e => TalentMetadata.compare(e, talent));

			this.talentsEl[idx].remove();

			this.talents.splice(idx, 1);
			this.talentsEl.splice(idx, 1);
		}
	}
	onRemove(cb: (talent: Talent) => Promise<boolean>): TalentList
	{
		this.removeCb = cb;

		return this;
	}
}

class TalentPicker extends Modal
{
	current: TalentMetadata;

	listElmt: HTMLElement;
	content: HTMLElement;
	button: Setting;

	option: Dropdown;
	needOption: boolean;
	currentOption: string;

	search: TextComponent;
	filter: string;

	picked: Talent[];
	level: number;

	stats: any;

	freeMode: boolean = false;

	res: any;
	rej: any;
	constructor(app: App)
	{
		super(app);

		let { contentEl, modalEl } = this;
		modalEl.classList.add("character-builder-talent-modal");
		const container = contentEl.createDiv("character-builder-talent-list-container");
		const group = container.createDiv("character-builder-talent-list-group");

		const searchGrp = group.createDiv("character-builder-talent-modal-search");
		this.search = new TextComponent(searchGrp);
		this.search.inputEl.addEventListener("input", e => { this.filter = this.search.getValue().toLowerCase(); this.renderList(); });

		new Setting(searchGrp).setName(`Désactiver les restrictions`).addToggle(tgl => tgl.onChange(e => { this.freeMode = e; this.renderList(); }));

		this.listElmt = group.createDiv("character-builder-talent-list");
		this.content = container.createDiv("character-builder-talent-content");

		contentEl.createDiv("character-builder-splitter-container", split => {
			this.option = new Dropdown(split);
			this.option.setting.classList.add("hidden");
			this.button = new Setting(split).addButton(btn => btn.setButtonText("Pick talent").onClick(() => this.confirm()));
			this.button.setDisabled(true);
		});
	}
	async pick(picked: Talent[], level: number, stats: any, metadata: Metadata): string
	{
		return new Promise((res, rej) => {
			this.res = res;
			this.rej = rej;

			this.picked = [...picked, 
				...Cache.cache(`races/${metadata.setting}/content/${metadata.race.name}/subraces/${metadata.race.subname}/talents`) ?? [], 
				...Cache.cache(`races/${metadata.setting}/content/${metadata.race.name}/features/${metadata.race.feature}/talents`) ?? []
			];
			this.level = level;
			this.stats = stats;
			this.open();

			this.content.empty();
			this.filter = "";
			this.renderList();
		});
	}

	renderList()
	{
		this.listElmt.empty();

		for(const [title, content] of Object.entries(Cache.cache("talents/tree")))
			this.addGroup(title, content, this.listElmt);
	}

	addGroup(title: string, content: any, parent: HTMLElement): boolean
	{
		const container = parent.createDiv("character-builder-talent-group-container");
		const header = container.createDiv("character-builder-talent-group-header", header => {
			header.createSpan({ cls: "character-builder-talent-group-title", text: title });
			header.addEventListener("click", () => container.classList.toggle("collapsed"));
		});
		const div = container.createDiv("character-builder-talent-group-content");

		let count = 0;
		for(const [childTitle, childContent] of Object.entries(content))
		{
			if(childContent instanceof TalentMetadata)
			{
				if((this.freeMode || TalentPicker.available(childContent, this.picked, this.level, this.stats)) && childTitle.toLowerCase().includes(this.filter))
				{
					this.addTalent(childTitle, childContent, div);
					count++;
				}
			}
			else
			{
				if(this.addGroup(childTitle, childContent, div, this.picked, this.level))
					count++;
			}
		}

		if(count === 0)
		{
			container.remove();
			return false;
		}

		return true;
	}

	addTalent(title: string, talent: TalentMetadata, parent: HTMLElement): void
	{
		const pos = title.toLowerCase().indexOf(this.filter);

		parent.createDiv("character-builder-talent-item", item => { 
			item.addEventListener("click", () => this.display(talent));
		}).createSpan("character-builder-talent-item-title", span => {
			span.createSpan({text: title.substring(0, pos)});
			span.createEl("strong", {text: title.substring(pos, pos + this.filter.length)});
			span.createSpan({text: title.substring(pos + this.filter.length)});
		});
	}

	static available(talent: TalentMetadata, picked: Talent[], level: number, stats: any): boolean
	{
		if(talent.level && talent.level > level) //Level requirement
			return false;

		if(TalentMetadata.includes(picked, talent.talent, true) && !talent.stackable) //Already picked requirement
			return false;

		if(talent.stats.length && talent.stats.every(e => stats[e.stat] < e.value)) //Stat requirement
			return false;

		if(talent.dependencies && talent.dependencies.length > 0 && !TalentMetadata.some(talent.dependencies, picked, true)) //Dependencies requirement
			return false;

		return true;
	}

	async display(talent: TalentMetadata): void
	{
		this.current = talent;
		this.content.empty();

		const editor = this.app.embedRegistry.getEmbedCreator(talent.file)({
			app: this.app,
			linktext: null,
			sourcePath: null,
			containerEl: this.content,
			displayMode: true,
			showInline: false,
			depth: 0
		}, talent.file);
		editor.loadFile();
		editor.inlineTitleEl?.remove();

		this.button.setDisabled(false);

		if(talent.options !== undefined)
		{
			this.option.setting.classList.remove("hidden");
			this.option.source(talent.options.map(e => e.subname)).link(this, "currentOption");
			this.needOption = true;
		}
		else
		{
			this.option.setting.classList.add("hidden");
			this.option.source();
			this.needOption = false;
			this.currentOption = "";
		}
	}

	confirm(): void
	{
		if(this.needOption && this.currentOption == "")
		{
			return new Notice("Ce talent nécessite de choisir une option.");
		}
		if(this.res)
		{
			const res = this.res;
			const currentOption = this.currentOption;
			this.res = undefined;
			this.rej = undefined;
			this.currentOption = "";

			this.content.empty();
			this.listElmt.empty();
			this.button.setDisabled(true);

			this.option.setting.classList.add("hidden");
			this.option.source();
			this.needOption = false;

			console.log(currentOption != "" ? this.current.options.find(e => e.subname === currentOption) : this.current.talent);
			this.close();
			res(currentOption != "" ? this.current.options.find(e => e.subname === currentOption) : this.current.talent);
		}
	}
	onClose(): void
	{
		if(this.rej)
		{
			const rej = this.rej;
			this.res = undefined;
			this.rej = undefined;

			rej();
		}
	}
}

function group(elmt: HTMLElement, title: string, collapsed: boolean = false, onContextMenu?: (e) => void): HTMLDivElement
{
	return elmt.createDiv("character-builder-group-container", container => {
		container.createDiv("character-builder-group-collapsible", div => {
			div.createDiv({cls: "character-builder-group-title", text: title});
			div.addEventListener("click", e => {
				container.classList.toggle("collapsed");
			});
			onContextMenu && div.addEventListener("contextmenu", onContextMenu);
		});
	
		if(collapsed)
			container.classList.add("collapsed");
	}).createDiv("character-builder-group-content");
}
