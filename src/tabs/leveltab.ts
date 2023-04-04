import { Setting, MarkdownPreviewView, Modal, App, ButtonComponent } from 'obsidian';
import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata, TalentMetadata, Talent } from 'src/metadata.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';

export class LevelTab extends Tab
{
	talents: Talent[];
	levels: Level[];

	talentPicker: TalentPicker;
	talentList: TalentList;
	render(): void
	{
		const metadata = this.metadata = this.request("metadata");

		this.content.empty();
		this.requiredList = [];

		this.talents = [];

		new Setting(this.content).addButton(btn => btn.setIcon("lucide-plus-circle").onClick(() => {
			const level = {
				level: this.levels.reduce((p, v) => Math.max(p, v.level), 0) + 1,
				talents: [],
				buffedStat: undefined,
				buffedSubstats: {},
				hp: 13,
				focus: 0,
				flavoring: undefined,
			};
			metadata.levels.push(level);
			this.renderLevel(level);
		}));

		if(metadata.levels.length === 0)
		{
			metadata.levels.push({
				level: 1,
				talents: [],
				buffedStat: undefined,
				buffedSubstats: {},
				hp: 13,
				focus: 0,
				flavoring: undefined,
			});
		}
		this.levels = metadata.levels;
		this.talentPicker = new TalentPicker(this.container.app);

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
			const hp = new Slider(split, "PV supplémentaires").range(0, 13, 1).link(level, "hp").desc("13 points à repartir entre PV et focus. " + (level.level === 1 ? `+${Cache.cache(`races/${this.metadata.setting}/content/${this.metadata.race.name}/health`)} PV de bonus racial au niveau 1.` : ""));
			const focus = new Slider(split, "Focus supplémentaire").range(0, 13, 1).link(level, "focus");

			hp.onChange((value) => focus.value(13 - value));
			focus.onChange((value) => hp.value(13 - value));

			if(level.level % 2 === 0)
				new Dropdown(split, "+3 sur une stat", false).source(StatBlockNames).link(level, "buffedStat").desc("Tous les niveaux pairs, vous obtenez un bonus de +3 sur une stat principale, dans la limite de 60 points au total.");
		});
		
		const talentList = new TalentList(grpEl, level.talents);
		talentList.onRemove((talent: Talent) => {
			this.talents.splice(this.talents.findIndex(e => TalentMetadata.compare(e, talent)), 1);
			level.talents.splice(level.talents.findIndex(e => TalentMetadata.compare(e, talent)), 1);
		}).onAddButton(() => this.pickTalent(talentList, level));
	}
	pickTalent(talentList: TalentList, level: Level)
	{
		const metadata = this.request("metadata");

		if(level.level === 1 && level.talents.length >= (6 - metadata.armor / 2))
			return new Notice("Vous avez déjà choisi tous vos talents pour ce niveau");
		else if(level.level > 1 && level.talents.length >= 1)
			return new Notice("Vous avez déjà choisi tous vos talents pour ce niveau");

		this.talentPicker.pick(this.talents, level.level).then(talent => {
			this.talents.push(talent);
			level.talents.push(talent);
			talentList.add(talent);
		}).catch(err => err && console.error(err));
	}
}

class TalentList
{
	container: HTMLElement;
	content: HTMLElement;

	talents: Talent[];
	talentsEl: HTMLElement[];
	addCb: () => void;
	removeCb: (talent: Talent) => void;
	constructor(parent: HTMLElement, talents: Talent[])
	{
		this.container = parent.createDiv("character-builder-talents-container");
		this.button = new ButtonComponent(this.container).setIcon("lucide-plus").onClick(() => this.addCb && this.addCb());
		this.content = this.container.createDiv("character-builder-talents-content");
		this.talents = [];
		this.talentsEl = [];

		for(let i = 0; i < talents.length; i++)
			this.add(talents[i]);
	}
	add(talent: Talent): void
	{
		this.talents.push(talent);
		this.talentsEl.push(this.content.createDiv({ cls: "character-builder-talent", text: TalentMetadata.text(talent) }, (div) => div.createSpan("character-builder-talent-remove").addEventListener("click", () => this.remove(talent))));
	}
	onAddButton(cb: () => void): TalentList
	{
		this.addCb = cb;

		return this;
	} 
	remove(talent: string): void
	{
		if(TalentMetadata.includes(this.talents, talent))
		{
			const idx = this.talents.findIndex(e => TalentMetadata.compare(e, talent));

			this.talentsEl[idx].remove();

			this.talents.splice(idx, 1);
			this.talentsEl.splice(idx, 1);

			this.removeCb && this.removeCb(talent);
		}
	}
	onRemove(cb: (talent: Talent) => void): TalentList
	{
		this.removeCb = cb;

		return this;
	}
}

class TalentPicker extends Modal
{
	talents: TalentMetadata[];

	current: TalentMetadata;

	listElmt: HTMLElement;
	content: HTMLElement;
	button: Setting;

	option: Dropdown;
	needOption: boolean;
	currentOption: string;

	res: any;
	rej: any;
	constructor(app: App)
	{
		super(app);
		this.talents = Object.values(Cache.cache("talents"));

		let { contentEl, modalEl } = this;
		modalEl.classList.add("character-builder-talent-modal");
		const container = contentEl.createDiv("character-builder-talent-list-container");
		this.listElmt = container.createDiv("character-builder-talent-list");
		this.content = container.createDiv("character-builder-talent-content");

		contentEl.createDiv("character-builder-splitter-container", split => {
			this.option = new Dropdown(split);
			this.option.setting.classList.add("hidden");
			this.button = new Setting(split).addButton(btn => btn.setButtonText("Pick talent").onClick(() => this.confirm()));
			this.button.setDisabled(true);
		});
	}
	async pick(picked: Talent[], level: number): string
	{
		return new Promise((res, rej) => {
			this.res = res;
			this.rej = rej;
			this.open();

			const pickableTalents = [];
			for(let i = 0; i < this.talents.length; i++)
			{
				const talent = this.talents[i];
				if(this.available(talent, picked, level))
				{
					pickableTalents.push(talent);
				}
			}

			const groups = pickableTalents.reduce((p, v) => {
				const parent = v.file.parent.name;
				if(!p.hasOwnProperty(parent))
					p[parent] = [];
				p[parent].push(v);
				return p;
			}, {});

			this.listElmt.empty();
			this.content.empty();

			for(const [key, value] of Object.entries(groups))
			{
				this.listElmt.createDiv("character-builder-talent-group-container", container =>  {
					let header;
					if(!key.includes("Talent de base"))
					{
						header = container.createDiv("character-builder-talent-group-header", header => {
							header.createSpan({ cls: "character-builder-talent-group-title", text: key });
							header.addEventListener("click", () => container.classList.toggle("collapsed"));
						});
					}
					container.createDiv("character-builder-talent-group-content", div => {
						value.forEach(e => div.createDiv("character-builder-talent-item", item => { item.addEventListener("click", () => this.display(e)); }).createSpan({ cls: "character-builder-talent-item-title", text: TalentMetadata.text(e.talent) }));
					});
				});
			}
		});
	}

	available(talent: TalentMetadata, picked: Talent[], level: number): boolean
	{
		if(talent.level && talent.level > level)
			return false;

		if(!picked || picked.length === 0)
		{
			if(talent.dependencies && talent.dependencies.length > 0)
				return false;
		}
		else
		{
			if(TalentMetadata.includes(picked, talent.talent, true) && !talent.stackable)
				return false;

			if(talent.dependencies && talent.dependencies.length > 0 && !TalentMetadata.some(talent.dependencies, picked, true))
				return false;
		}

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

function group(elmt: HTMLElement, title: string, collapsed: boolean = false): HTMLDivElement
{
	return elmt.createDiv("character-builder-group-container", container => {
		container.createDiv("character-builder-group-collapsible", div => {
			div.createDiv({cls: "character-builder-group-title", text: title});
			div.addEventListener("click", e => {
				container.classList.toggle("collapsed");
			});
		});
	
		if(collapsed)
			container.classList.add("collapsed");
	}).createDiv("character-builder-group-content");
}