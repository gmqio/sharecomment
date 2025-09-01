const btn_add_annotation = 'btn_add_annotation';

chrome.runtime.onInstalled.addListener(() => {
	chrome.contextMenus.create({
		id: 'btn_add_annotation',
		title: 'Upsert Comments',
		type: 'normal',
		contexts: ['all']
	});
	// 添加"跳转元宝"右键菜单
	chrome.contextMenus.create({
		id: 'btn_jump_yuanbao',
		title: '跳转元宝AI解释',
		type: 'normal',
		contexts: ['selection']  // 仅在选中文本时显示
	});
});


// 在background script中不能直接访问document，需要通过消息让content script执行复制操作
function copyToClipboard(text, tabId) {
	// 向content script发送消息，让它执行复制操作
	chrome.tabs.sendMessage(tabId, {
		action: "copyToClipboard",
		text: text
	});
}


function buildGetParams(data) {
	return Object.keys(data)
		.map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
		.join('&');
}
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.action === "getNotesByLine") {
		fetch('http://api.githubapp.demoworld.tech:80/note/query?' + buildGetParams(request.data))
			.then(response => response.json())
			.then(data => sendResponse({ data: data }))
			.catch(error => sendResponse({ e: error }));
	}
	if (request.action === "addNewNotes") {
		fetch(
			"http://api.githubapp.demoworld.tech:80/note/add",
			{
				method: 'POST',
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(request.data),
				mode: 'no-cors'
			}
		)
			.then(data => {
				console.log("send result done", data);
				chrome.runtime.sendMessage({ action: 'send_popup_add_result_success', data: request.data });
				sendResponse({ data: data });
			})
			.catch(error => {
				console.log("send result error", error);
				if (error && Object.keys(error).length > 0) {
					chrome.runtime.sendMessage({ action: 'send_popup_add_result_error', ex: error });
				} else {
					chrome.runtime.sendMessage({ action: 'send_popup_add_result_success', data: {} });
				}

				sendResponse({ e: error })
			});
	}

	if (request.action === "passSelectedInfo") {
		chrome.storage.local.set({
			selectedInfo: request.data
		});
	}

	if (request.action === "queryUserNoteCount") {
		fetch('http://api.githubapp.demoworld.tech:80/note/queryUserNoteCount?' + buildGetParams(request.data))
			.then(response => response.json())
			.then(data => sendResponse({ data: data }))
			.catch(error => sendResponse({ e: error }));
	}

	return true;
});

function debug(message, sendResponse) {
	fetch(
		"http://127.0.0.1:8080/debug",
		{
			method: 'POST',
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(message),
			mode: 'no-cors'
		}
	)
		.then(response => response.json())
		.then(data => sendResponse({ data: data }))
		.catch(error => sendResponse({ e: error }));
}

chrome.contextMenus.onClicked.addListener((item, tab) => {
	const s_id = item.menuItemId;
	const s_text = item.selectionText;
	if (s_id == 'btn_add_annotation') {
		chrome.windows.create({
			url: "html/popup-input.html",
			type: 'popup',
			width: 540,
			height: 230,
			left: 500,
			top: 500
		});
	}
// 处理"跳转元宝AI"菜单项点击
	else if (s_id == 'btn_jump_yuanbao' && tab) {
		// 检查是否选中文本
		if (s_text) {
			// 检查当前页面是否是GitHub
			let textToCopy = "解释代码: " + s_text + " 含义，用中文回答";
			let codeLanguage = "";
			let fileName = "";
			
			// 从URL中提取文件扩展名并判断代码语言和文件名
			if (tab.url) {
				codeLanguage = getCodeLanguageFromUrl(tab.url);
				fileName = getFileNameFromUrl(tab.url);
				if (codeLanguage) {
					textToCopy += `\n[代码语言: ${codeLanguage}]`;
				}
				if (fileName) {
					textToCopy += `\n[文件名: ${fileName}]`;
				}
			}
			
			if (tab.url && tab.url.includes('github.com')) {
				// 从URL中提取GitHub项目名
				const urlParts = tab.url.split('/');
				// GitHub URL格式通常是：https://github.com/username/repository/...
				if (urlParts.length >= 5) {
					const userName = urlParts[3];
					const repoName = urlParts[4];
					const projectName = `${userName}/${repoName}`;
					// 添加GitHub项目信息
					textToCopy = textToCopy + `\n[GitHub项目: ${projectName}]`;
				}
			}
			
			// 复制拼接后的文字，传入tabId让content script执行操作
			copyToClipboard(textToCopy, tab.id);
			console.log('已发送复制命令: ' + textToCopy);
			
			// 显示气泡提示
			chrome.tabs.sendMessage(tab.id, {
				action: "showNoSelectionTooltip"
			}, function(response) {
				if (response && response.success) {
					console.log('已显示提示');
					// 1秒后跳转
					setTimeout(function() {
						chrome.tabs.create({ url: 'https://yuanbao.tencent.com/' });
					}, 1000);
				} else {
					console.error('显示提示失败，直接跳转');
					chrome.tabs.create({ url: 'https://yuanbao.tencent.com/' });
				}
			});
		} else {
			// 未选中文本，显示提示
			chrome.tabs.sendMessage(tab.id, {
				action: "showNoSelectionTooltip"
			}, function(response) {
				if (response && response.success) {
					console.log('已显示未选中文本提示');
				} else {
					console.error('显示提示失败');
				}
			});
		}
	}
// 闭合chrome.contextMenus.onClicked.addListener
});

// 根据URL中的文件扩展名判断代码语言
function getCodeLanguageFromUrl(url) {
	// 常见编程语言文件扩展名映射
	const languageMap = {
		'.js': 'JavaScript',
		'.ts': 'TypeScript',
		'.jsx': 'React JSX',
		'.tsx': 'React TypeScript',
		'.html': 'HTML',
		'.css': 'CSS',
		'.scss': 'SCSS',
		'.sass': 'SASS',
		'.less': 'LESS',
		'.py': 'Python',
		'.java': 'Java',
		'.c': 'C',
		'.cpp': 'C++',
		'.cs': 'C#',
		'.go': 'Go',
		'.rs': 'Rust',
		'.php': 'PHP',
		'.rb': 'Ruby',
		'.swift': 'Swift',
		'.kt': 'Kotlin',
		'.sh': 'Shell',
		'.bash': 'Bash',
		'.zsh': 'Zsh',
		'.sql': 'SQL',
		'.json': 'JSON',
		'.xml': 'XML',
		'.yaml': 'YAML',
		'.yml': 'YAML',
		'.md': 'Markdown',
		'.dockerfile': 'Dockerfile',
		'.docker-compose.yml': 'Docker Compose',
		'.tsv': 'TSV',
		'.csv': 'CSV',
		'.log': 'Log',
		'.txt': 'Text'
	};
	
	// 从URL中提取文件路径部分（去掉查询参数和锚点）
	const cleanUrl = url.split('?')[0].split('#')[0];
	
	// 检查URL是否包含常见的代码文件扩展名
	for (const [ext, language] of Object.entries(languageMap)) {
		if (cleanUrl.toLowerCase().endsWith(ext)) {
			return language;
		}
	}
	
	return '';
}

// 从URL中提取文件名
function getFileNameFromUrl(url) {
	// 从URL中提取文件路径部分（去掉查询参数和锚点）
	const cleanUrl = url.split('?')[0].split('#')[0];
	
	// 获取URL路径的最后一部分作为文件名
	const urlParts = cleanUrl.split('/');
	// 过滤掉空字符串
	const nonEmptyParts = urlParts.filter(part => part !== '');
	
	if (nonEmptyParts.length > 0) {
		// 检查最后一部分是否包含扩展名（至少有一个点，并且点不是最后一个字符）
		const lastPart = nonEmptyParts[nonEmptyParts.length - 1];
		if (lastPart.includes('.') && lastPart.lastIndexOf('.') < lastPart.length - 1) {
			return lastPart;
		}
	}
	
	return '';
}
