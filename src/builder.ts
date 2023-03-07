import { CharacterBuilderCache as Cache } from 'src/cache.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata } from 'src/metadata.ts';

export function print(data: any, template: string): string
{
	const settings = Cache.cache("settings");
	return template.replaceAll("{statblock}", statblock(data.statBlock))
					.replaceAll("{substatblock}", substats(data.substats))
					.replaceAll("{armor}", data.armor)
					.replaceAll("{luck}", data.luck)
					.replaceAll("{race-name}", `${data.race}`)
					.replaceAll("{race-desc}", `![[${settings.racesFolder}/${data.setting}/${data.race}#TRAITS GÉNÉRAUX]]\n![[${settings.racesFolder}/${data.setting}/${data.race}#BONUS GLOBAUX]]`)
					.replaceAll("{subrace-name}", `${data.subrace}`)
					.replaceAll("{subrace-desc}", `![[${settings.racesFolder}/${data.setting}/${data.race}#${data.subrace}]]`)
					.replaceAll("{feature-name}", `${data.feature}`)
					.replaceAll("{feature-desc}", Cache.cache(`races/${data.setting}/content/${data.race}/features/${data.feature}`))
					.replaceAll("{flavoring}", data.flavoring);
}

function table(header: string[], content: string[][]): string
{
	output = "|";
	for(let i = 0; i < header.length; i++)
	{
		output += `${header[i]}|`;
	}
	output += `\n|`;
	for(let i = 0; i < header.length; i++)
	{
		output += `---|`;
	}
	output += `\n|`;
	for(let i = 0; i < content.length; i++)
	{
		for(let j = 0; j < content[i].length; j++)
		{
			output += `${content[i][j]}|`;
		}
		if(i !== content.length -1)
			output += `\n|`;
	}

	return output;
}
function stat(value: Stat, divider: number = 1): string
{
	return Math.floor((value.initial + value.bonus) / divider);
}
function statblock(value: StatBlock): string
{
	const header = Object.values(StatBlockNames);
	const content = [[], [], []];
	let i = 0;
	for(const key in value)
	{
		if(!value.hasOwnProperty(key))
			continue;

		content[0][i] = `${value[key].initial} (+*${value[key].bonus}*)`;
		content[1][i] = `${stat(value[key], 2)}`;
		content[2][i] = `${stat(value[key], 5)}`;
		i++;
	}
	return table(header, content);
}
function list(value: any[]): string
{
	let content = "";
	for(let i = 0; i < value.length; i++)
		content += `- ${value[i]}\n`;
	return content;
}
function substats(value: Substats): string
{
	let content = "";
	const names = Object.keys(value);
	for(let i = 0; i < names.length; i++)
		content += `- **${names[i]}**: ${stat(value[names[i]], 1)} (*${stat(value[names[i]], 2)}*, *${stat(value[names[i]], 5)}*)\n`;
	return content;
}
