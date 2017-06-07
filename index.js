const getStdin = require('get-stdin');
const fs = require('fs');
const path = require('path');
const escape = require('escape-html');

const template = fs.readFileSync(path.resolve(__dirname, 'tpl.html'), 'utf8');

const tabSize = 2;

const htmlTab = Array.from({ length : tabSize + 1 }).join('&nbsp;');

function render(content) {
	return template.replace('%content%', content);
}


function extractMessages(error) {
	let extras = [];
	if (error.extra) {
		console.error("Has extra");
		extras = error.extra.map(extra => extra.message).reduce((acc, extra) => [...acc, ...extra], []);
		console.error(extras);
	}
	return [...error.message, ...extras];
}
function flattenMessages(acc, messages) {
	let bundle = [];
	messages.forEach(message => {
		if (message.type === 'Comment') {
			const last = bundle.pop();
			last.descr = `${last.descr}. ${message.descr}`;
			bundle.push(last);
		} else {
			bundle.push(message);
		}
	});
	return [...acc, bundle];
}

function strToHtml(str) {
	return escape(str)
		.replace(/\t/g, htmlTab)
		.replace(/ /g, '&nbsp;');
}

//strlen with fix tabsize
function strLen(str) {
	const baseLength = str.length;
	const tabCount = str.split('\t').length - 1;
	return (baseLength - tabCount) + (tabCount * tabSize);
}

function groupToHtml({ source, bundles }) {
	const errors = bundles
		.map(bundleToHtml)
		.map(bundle => `<li class="error" onclick="collapse(this)">${bundle}</li>`)
		.join('\n');
	return `<div class="source-group">
		<a class="source" onclick="collapse(this.parentNode)">
			${source}
			<span class="count">(${bundles.length} errors)</span>
		</a>
		<ul class="error-group">
			${errors}
		</ul>
	</div>`;
}

function bundleToHtml(bundle) {
	return bundle.map(messageToHtml).join('\n');;
}

function messageToHtml(message) {
	const prefix = message.context.substring(0, message.loc.start.column - 1);
	const error = message.context.substring(message.loc.start.column - 1, message.loc.end.column);
	const postfix = message.context.substr(message.loc.end.column);

	const messageSpacing = Array.from({ length : strLen(prefix) + 1 }).join(' ');
	const messageArrows = Array.from({ length : strLen(error) + 1 }).join('^');
	const fullMessage = `${strToHtml(messageSpacing)}${messageArrows} ${strToHtml(message.descr)}`;

	const line = message.loc.start.line;

	const context = `${strToHtml(prefix)}<span class='theError'>${strToHtml(error)}</span>${strToHtml(postfix)}`;
	return `<span class="message">
			<span class="context"><span class="line">${line}:</span>${context}</span>
			<span class="message-text"><span class="line"></span>${fullMessage}</span>
		</span>`;
}

function groupByFile(acc, bundle) {
	const source = bundle[0].loc.source;
	acc[source] = acc[source] || [];
	acc[source].push(bundle);
	return acc;
}

async function run() {
	const stdin = await getStdin();
	const json = JSON.parse(stdin);
	if (json.passed) {
		console.log(render("<h1>No errors</h1>"));
		return;
	}

	const grouped = json
		.errors
		.map(extractMessages)
		.reduce(flattenMessages, [])
		.reduce(groupByFile, {});
	const content = Object.entries(grouped)
		.map(([source, bundles]) => ({ source, bundles }))
		.map(groupToHtml)
		.join('\n');
	console.log(render(content));
}

run();
