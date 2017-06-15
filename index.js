#!/usr/bin/env node

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
	let messages = [...error.message];
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
			${source}
			<span class="count">(${bundles.length} errors)</span>
		</a>
		<ul class="file-errors">
			${errors}
		</ul>
	</div>`;
}

function bundleToHtml(bundle) {
	let collect = '<span onclick="collapse(this, event)" class="error-group">\n';
	for (let message of bundle.message) {
		collect += messageToHtml(message) + '\n';
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

function messageToHtml(message) {
	const messageContext = message.context || '';
	const prefix = messageContext.substring(0, message.start - 1);
	const error = messageContext.substring(message.start - 1, message.end);
	const postfix = messageContext.substr(message.end);

	const messageSpacing = Array.from({ length : strLen(prefix) + 1 }).join(' ');
	const messageArrows = Array.from({ length : strLen(error) + 1 }).join('^');
	const fullMessage = `${strToHtml(messageSpacing)}${messageArrows} ${strToHtml(message.descr)}`;

	const line = message.line;

	const context = `${strToHtml(prefix)}<span class='theError'>${strToHtml(error)}</span>${strToHtml(postfix)}`;
	return `<span class="message line-${line}">
			<span class="context"><span class="line">${line}:</span>${context}</span>
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
