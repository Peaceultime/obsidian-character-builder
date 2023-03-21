import { Setting } from 'obsidian';
import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';

export class LevelTab extends Tab
{
	talents: string[];
	level: number; //TEST

	talentPicker: TalentPicker;
	render(): void
	{
		this.content.empty();
		this.requiredList = [];

		const metadata = this.request("metadata");
		this.talentPicker = new TalentPicker(this.content);

		this.talents = [];
		this.level = 0;

		this.levelUp();
	}
	levelUp()
	{
		this.level++;
		this.talentPicker.pick(this.talents, this.level /*TEST*/).then(talent => {
			this.talents.push(talent);
			this.levelUp(); //TEST
		});
	}
}

class TalentPicker
{
	talents: any;

	listElmt: HTMLElement;
	content: HTMLElement;
	constructor(parent: HTMLElement)
	{
		this.talents = Cache.cache("talents");

		const container = parent.createDiv("character-builder-talent-list-container");
		this.listElmt = container.createDiv("character-builder-talent-list");
		this.content = container.createDiv("character-builder-talent-content");
	}
	async pick(picked: string[], level: number): string
	{
		return new Promise((res, rej) => {
			let currentTalent = "";

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

						});
					}
					container.createDiv("character-builder-talent-group-content", div => {
						value.forEach(e => div.createDiv("character-builder-talent-item").createSpan({ cls: "character-builder-talent-item-title", text: e.filename }))
					});
				});
			}

			new Setting(this.content).addButton(btn => btn.setButtonText("Pick talent").onClick(() => currentTalent !== "" && res(currentTalent)));
		});
	}

	available(talent: any, picked: string[], level: number): boolean
	{
		if(!talent.stack && picked.length > 0 && picked.every(e => e.includes("#") ? e.startsWith(talent.filename + "#") : e === talent.filename))
			return false;

		if(talent.levelRequired && talent.levelRequired > level)
			return false;

		if(talent.talentsRequired && (picked.length === 0 || talent.talentsRequired.every(e => !picked.includes(e))))
			return false;

		return true;
	}
}