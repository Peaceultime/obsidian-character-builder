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

	hps: Slider[];
	focuses: Slider[];
	render(): void
	{
		const metadata = this.metadata = this.request("metadata");

		this.content.empty();
		this.requiredList = [];

		this.talents = [];
		this.hps = [];
		this.focuses = [];

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
			split.createDiv(undefined, div => {
				const hp = new Slider(div, "PV", false).range(0, 13, 1).link(level, "hp");
				const focus = new Slider(div, "Focus", false).range(0, 13, 1).link(level, "focus").desc("13 points à repartir entre PV et focus.");

				hp.onChange((value) => { focus.value(13 - value); this.updateSliderTooltips(); });
				focus.onChange((value) => { hp.value(13 - value); this.updateSliderTooltips(); });

				this.hps.push(hp);
				this.focuses.push(focus);

				if(level.level % 2 === 0)
					new Dropdown(div, "+3 sur une stat", false).source(StatBlockNames).link(level, "buffedStat").desc("Tous les niveaux pairs, vous obtenez un bonus de +3 sur une stat principale, dans la limite de 60 points au total.");
			})
		
			const talentList = new TalentList(split, level.talents);
			talentList.onRemove((talent: Talent) => {
				this.talents.splice(this.talents.findIndex(e => TalentMetadata.compare(e, talent)), 1);
				level.talents.splice(level.talents.findIndex(e => TalentMetadata.compare(e, talent)), 1);
			}).onAddButton(() => this.pickTalent(talentList, level));
		});

		this.updateSliderTooltips();
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
	updateSliderTooltips()
	{
		let hp = Cache.cache(`races/${this.metadata.setting}/content/${this.metadata.race.name}/health`), focus = 0;
		for(let i = 0; i < this.hps.length; i++)
		{
			hp += this.hps[i].component.getValue();
			this.hps[i].tooltip(hp);

			focus += this.focuses[i].component.getValue();
			this.focuses[i].tooltip(focus);
		}
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
	talents: any;

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
		this.talents = Cache.cache("talents");

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

			this.listElmt.empty();
			this.content.empty();

			for(const [title, content] of Object.entries(this.talents))
				this.addGroup(title, content, this.listElmt, picked, level);

			/*const pickableTalents = [];
			for(let i = 0; i < this.talents.length; i++)
			{
				const talent = this.talents[i];
				if(this.available(talent, picked, level))
				{
					pickableTalents.push(talent);
				}
			}*/

			/*const groups = pickableTalents.reduce((p, v) => {
				const parent = v.file.parent.name;
				if(!p.hasOwnProperty(parent))
					p[parent] = [];
				p[parent].push(v);
				return p;
			}, {});*/

			/*for(const [key, value] of Object.entries(groups))
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
			}*/
		});
	}

	addGroup(title: string, content: any, parent: HTMLElement, picked: Talent[], level: number): boolean
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
				if(this.available(childContent, picked, level))
				{
					this.addTalent(childTitle, childContent, div);
					count++;
				}
			}
			else
			{
				if(this.addGroup(childTitle, childContent, div, picked, level))
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
		parent.createDiv("character-builder-talent-item", item => { 
			item.addEventListener("click", () => this.display(talent));
		}).createSpan({ cls: "character-builder-talent-item-title", text: title });
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