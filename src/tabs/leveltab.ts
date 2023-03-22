import { Setting, MarkdownPreviewView, Modal, App } from 'obsidian';
import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';

export class LevelTab extends Tab
{
	talents: string[];
	levels: Level[];

	talentPicker: TalentPicker;
	talentList: TalentList;
	render(): void
	{
		const metadata = this.request("metadata");

		this.content.empty();
		this.requiredList = [];

		this.talents = [];

		new Setting(this.content).addButton(btn => btn.setIcon("lucide-plus-circle").onClick(() => {
			const level = {
				level: this.levels.reduce((p, v) => Math.max(p, v.level), 0) + 1,
				talents: [],
				buffedStat: "",
				buffedSubstats: {},
				hp: 13,
				focus: 0,
				flavoring: "",
			};
			metadata.levels.push(level);
			this.renderLevel(level);
		}));

		if(metadata.levels.length === 0)
		{
			metadata.levels.push({
				level: 1,
				talents: [],
				buffedStat: "",
				buffedSubstats: {},
				hp: 13,
				focus: 0,
				flavoring: "",
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
		if(level.level % 2 === 0)
			new Dropdown(grpEl, "Bonus de +2 sur une stat principale").source(Object.values(StatBlockNames)).link(level, "buffedStat");

		grpEl.createDiv("character-builder-splitter-container", split => {
			const talentList = new TalentList(split);
			talentList.onRemove((talent: string) => {
				this.talents.splice(this.talents.findIndex(e => e === talent), 1);
				level.talents.splice(level.talents.findIndex(e => e === talent), 1);
			});

			new Setting(split).addButton(btn => btn.setIcon("lucide-plus").onClick(() => this.pickTalent(talentList, level)));
		});
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
		}).catch(() => {});
	}
}

class TalentList
{
	container: HTMLElement;
	content: HTMLElement;

	talents: string[];
	talentsEl: HTMLElement[];
	cb: (talent: string) => void;
	constructor(parent: HTMLElement)
	{
		this.container = parent.createDiv("character-builder-talents-container").createDiv("character-builder-talents-content");
		this.talents = [];
		this.talentsEl = [];
	}
	add(talent: string): void
	{
		this.talents.push(talent);
		this.talentsEl.push(this.container.createDiv({ cls: "character-builder-talent", text: talent }, (div) => div.createSpan("character-builder-talent-remove").addEventListener("click", () => this.remove(talent))));
	}
	remove(talent: string): void
	{
		if(this.talents.includes(talent))
		{
			const idx = this.talents.findIndex(e => e === talent);

			this.talentsEl[idx].remove();

			this.talents.splice(idx, 1);
			this.talentsEl.splice(idx, 1);

			this.cb && this.cb(talent);
		}
	}
	onRemove(cb: (talent: string) => void): void
	{
		this.cb = cb;
	}
}

class TalentPicker extends Modal
{
	talents: any;

	current: string;

	listElmt: HTMLElement;
	content: HTMLElement;
	button: Setting;

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

		this.button = new Setting(contentEl).addButton(btn => btn.setButtonText("Pick talent").onClick(() => this.confirm()));
		this.button.setDisabled(true);
	}
	async pick(picked: string[], level: number): string
	{
		console.log(picked);
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
				if(!p.hasOwnProperty(v.type))
					p[v.type] = [];
				p[v.type].push(v);
				return p;
			}, {});

			this.listElmt.empty();
			this.content.empty();

			for(const [key, value] of Object.entries(groups))
			{
				this.listElmt.createDiv("character-builder-talent-group-container", container =>  {
					let header;
					if(key !== 'initial')
					{
						header = container.createDiv("character-builder-talent-group-header", header => {
							header.createSpan({ cls: "character-builder-talent-group-title", text: key });
							header.addEventListener("click", () => container.classList.toggle("collapsed"));
						});
					}
					container.createDiv("character-builder-talent-group-content", div => {
						value.forEach(e => div.createDiv("character-builder-talent-item", item => { item.addEventListener("click", () => this.display(e)); }).createSpan({ cls: "character-builder-talent-item-title", text: e.filename }));
					});
				});
			}
		});
	}

	available(talent: any, picked: string[], level: number): boolean
	{
		if(!talent.stack && picked.length > 0 && picked.some(e => e.includes("#") ? e.startsWith(talent.filename + "#") : e === talent.filename))
			return false;

		if(talent.levelRequired && talent.levelRequired > level)
			return false;

		if(talent.talentsRequired && (picked.length === 0 || talent.talentsRequired.some(e => !picked.includes(e))))
			return false;

		return true;
	}

	async display(talent: any): void
	{
		this.current = talent.filename;
		this.content.empty();

		const file = this.app.vault.getAbstractFileByPath(talent.path);
		const editor = this.app.embedRegistry.getEmbedCreator(file)({
		    app: this.app,
		    linktext: null,
		    sourcePath: null,
		    containerEl: this.content,
		    displayMode: true,
		    showInline: false,
		    depth: 0
		}, file);
		editor.loadFile();
		editor.inlineTitleEl?.remove();

		this.button.setDisabled(false);
	}

	confirm(): void
	{
		if(this.res)
		{
			const res = this.res;
			this.res = undefined;
			this.rej = undefined;

			this.content.empty();
			this.listElmt.empty();
			this.button.setDisabled(true);

			console.log(this.current);
			this.close();
			res(this.current);
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