#!/usr/bin/env node

const getStdin = require('get-stdin');
const fs = require('fs');
const path = require('path');
const escape = require('escape-html');

const template = fs.readFileSync(path.resolve(__dirname, 'tpl.html'), 'utf8');

const tabSize = 2;

const htmlTab = Array.from({ length : tabSize + 1 }).join('&nbsp;');

let sourceRoot = '/';
if (process.argv[2] && process.argv[2] === '--root') {
	sourceRoot = path.resolve(process.cwd(), process.argv[3]);;
}

function render(content) {
	return template.replace('%content%', content);
}


function extractMessages(error) {
	let messages = [...error.message];
	if (error.operation) {
		messages.unshift(error.operation);
	}
	let extras = [];
	let children = [];
	if (error.extra) {
		extras = error.extra.map(extra => extractMessages(extra));
	}
	if (error.children) {
		children = error.children.map(child => extractMessages(child))
	}
	return {
		message : flattenMessages(messages),
		extras,
		children
	}
}

function flattenMessages(messages) {
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
	return bundle;
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
		.map(bundle => `<li class="error">${bundle}</li>`)
		.join('\n');
	return `<div class="source-group">
		<a class="source" onclick="collapse(this.parentNode, event)">
			${path.relative(sourceRoot, source)}
			<span class="count">(${bundles.length} errors)</span>
		</a>
		<ul class="file-errors">
			${errors}
		</ul>
	</div>`;
}

function bundleToHtml(bundle) {
	const mainSource = bundle.message[0].path;
	let collect = '<span onclick="collapse(this, event)" class="error-group">\n';
	for (let message of bundle.message) {
		collect += messageToHtml(message, mainSource !== message.path) + '\n';
	}
	for (let extra of bundle.extras) {
		collect += '<span class="extra">\n';
		collect += bundleToHtml(extra);
		collect += '</span>\n';
	}
	for (let child of bundle.children) {
		collect += '<span class="child">\n';
		collect += bundleToHtml(child);
		collect += '</span>\n';
	}
	collect += '</span>\n'
	return collect;
	//return bundle.map(messageToHtml).join('\n');;
}

function messageToHtml(message, includeSource = false) {
	const messageContext = message.context || '';
	const loc = message.loc || {
		start : { column : 0 },
		end : { column : 0 }
	};
	const start = loc.start.column;
	const end = loc.start.line === loc.end.line ? loc.end.column : messageContext.length;
	const prefix = messageContext.substring(0, start - 1);
	const error = messageContext.substring(start - 1, end);
	const postfix = messageContext.substring(end);

	const messageSpacing = Array.from({ length : strLen(prefix) + 1 }).join(' ');
	const messageArrows = Array.from({ length : strLen(error) + 1 }).join('^');
	const fullMessage = `${strToHtml(messageSpacing)}${messageArrows} ${strToHtml(message.descr)}`;

	const line = message.line;
	const endLine = message.line !== message.endline ? `...${message.endline}` : ``;

	const context = `${strToHtml(prefix)}<span class='theError'>${strToHtml(error)}</span>${strToHtml(postfix)}`;
	const source = includeSource ? `<span class="alternative-source">&lt;-- ${path.relative(sourceRoot, message.path)}</span>` : '';
	const lineTitle = includeSource ? ` title="${message.path}"` : '';
	return `<span class="message line-${line}">
			${source}
			<span class="context"><span class="line" ${lineTitle}>${line}${endLine}:</span>${context}</span>
			<span class="message-text"><span class="line"></span>${fullMessage}</span>
		</span>`;
}

function groupByFile(acc, bundle) {
	const source = bundle.message[0].path;
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
		//.reduce(flattenMessages, [])
		.reduce(groupByFile, {});
	const content = Object.entries(grouped)
		.map(([source, bundles]) => ({ source, bundles }))
		.map(groupToHtml)
		.join('\n');
	console.log(render(content));
}

run();
