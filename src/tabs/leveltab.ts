import { Dropdown, TextField, TextArea, Slider } from 'src/components.ts';
import { Tab, TabContainer } from 'src/tab.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';
import { HTMLStatElement } from 'src/htmlelements.ts';
import { CharacterBuilderCache as Cache } from 'src/cache.ts';

export class LevelTab extends Tab
{
	render()
	{
		this.content.empty();
		this.requiredList = [];

		const metadata = this.request("metadata");
	}
}