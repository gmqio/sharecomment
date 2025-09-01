// from doc : https://docs.qq.com/sheet/DUnd3bU1Xb3VsclVG?tab=BB08J2
String.prototype.format = function () {
    var formatted = this;
    for (var arg in arguments) {
        formatted = formatted.replace("{" + arg + "}", arguments[arg]);
    }
    return formatted;
};

// 显示气泡提示
function showNoSelectionTooltip() {
    // 检查是否已存在提示元素，如果存在则移除
    const existingTooltip = document.getElementById('no-selection-tooltip');
    if (existingTooltip) {
        document.body.removeChild(existingTooltip);
    }
    
    // 创建气泡提示元素
    const tooltip = document.createElement('div');
    tooltip.id = 'no-selection-tooltip';
    tooltip.innerText = '去元宝直接粘贴';
    
    // 设置样式 - 居中显示
    tooltip.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        animation: fadeIn 0.3s ease-out;
    `;
    
    // 添加动画样式
    const style = document.createElement('style');
    style.textContent = `
        @keyframes fadeIn {
            from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); }
            to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    
    // 添加到文档中
    document.body.appendChild(tooltip);
    
    // 1秒后自动消失
    setTimeout(() => {
        tooltip.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(tooltip)) {
                document.body.removeChild(tooltip);
            }
            // 移除样式元素（如果没有其他元素使用）
            if (document.head.contains(style)) {
                document.head.removeChild(style);
            }
        }, 300);
    }, 1000);
}

// 监听来自background script的消息
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    // 处理复制文本到剪贴板的请求
    if (request.action === "copyToClipboard" && request.text) {
        // 创建临时文本区域
        const textarea = document.createElement('textarea');
        textarea.value = request.text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        // 将文本区域添加到文档中
        document.body.appendChild(textarea);
        // 选择并复制文本
        textarea.select();
        try {
            document.execCommand('copy');
            console.log('成功复制文本: ' + request.text);
            sendResponse({success: true});
        } catch (err) {
            console.error('复制失败: ', err);
            sendResponse({success: false, error: err});
        } finally {
            // 移除临时文本区域
            document.body.removeChild(textarea);
        }
    }
    // 处理显示未选中文字提示的请求
    else if (request.action === "showNoSelectionTooltip") {
        showNoSelectionTooltip();
        sendResponse({success: true});
    }
    // 确保异步响应也能被处理
    return true;
});

// 计算textare选中的文字所处行数
function getSelectedTextLine(textarea) {
    var startPos = textarea.selectionStart;
    var textBeforeSelection = textarea.value.substring(0, startPos);
    var lineNumber = textBeforeSelection.split("\n").length;
    return lineNumber;
}

// 获取当前登录的用户名
function getUserName() {
    var metaTag = document.querySelector('meta[name="user-login"]');
    if (metaTag) {
        return metaTag.getAttribute("content");
    } else {
        return "no";
    }
}

// 设置当前行的注释内容
function setNoteContent(lineDiv, tipId) {
    for (var note of notes_arr) {
        if ($(lineDiv).attr('data-line-number') == note.selected_line) {
            $('#' + tipId).html(note.note);
        }
    }
}

// 获取当前页面的源代码文件信息
function getFileInfo() {
    var filePath = location.href.split('/');
    var repo = filePath[3];
    var project = filePath[4];
    var fileUrl = '';

    if (location.href.indexOf('#') > -1) {
        fileUrl = location.href.substring(0, location.href.indexOf('#'));
    } else if (location.href.indexOf('?') > -1) {
        fileUrl = location.href.substring(0, location.href.indexOf('?'));
    } else {
        fileUrl = location.href;
    }

    return {
        GithubRepo: repo,
        GithubProject: project,
        GithubURL: fileUrl
    }

}

var all_comment_arr = [];
var all_line_content_arr = []
var line_comment_id_map = {}

var WRITE_MODE = 'write'
var READ_MODE = 'read'

var currentUserName;

function isGithubSourceCodePage() {
    return document.getElementById('read-only-cursor-text-area');
}

$(document).ready(function () {
    if (!isGithubSourceCodePage()) {
        return;
    }
    currentUserName = getUserName();

    all_line_content_arr = document.getElementById('read-only-cursor-text-area').value.split('\n');
    // 右键菜单点击响应， 将选中的文本发送到backgroud script中
    document.addEventListener('contextmenu', function (e) {
        var textarea = document.getElementById('read-only-cursor-text-area');
        if (textarea && textarea === document.activeElement && textarea.selectionStart !== textarea.selectionEnd) {
            var selectedText = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd);
            var selectedLine = getSelectedTextLine(textarea);

            // 获取当前选中行的注释内容，传递到弹窗中展示
            var comment_content;
            for (var item of all_comment_arr) {
                if (item.selected_line == selectedLine) {
                    comment_content = item.note;
                    break;
                }
            }

            var current = {
                OldContent: comment_content,
                UserName: currentUserName,
                SelectedText: selectedText,
                SelectedLine: selectedLine,
                ...getFileInfo()
            };

            chrome.runtime.sendMessage({
                data: current,
                action: "passSelectedInfo"
            }, function (response) {
                console.log("passSelectedInfo callback", response)
            });
        }
    });

    // 加载当前网页源代码的注释简要信息， 做成下拉菜单供用户选择
    loadCommentSummary();

    changeMode(WRITE_MODE, currentUserName);
});

function showRightPanel(show) {
    if (show) {
        $('#symbols-pane').parent().show();
    } else {
        $('#symbols-pane').parent().hide();
    }
}

function clearAllTips() {
    resetCodeLines(true, true);

    resetTips();

    Object.keys(line_comment_id_map).forEach(key => delete line_comment_id_map[key]);
}

// 删除注释元素
function resetTips() {
    $(".tip").off("mouseenter mouseleave").remove();
}
// 重置行号，删除行号honver事件
function resetCodeLines(resetLineNumber, resetHover) {
    $('.react-line-number').each((index, lineDiv) => { // <div data-line-number="2" class="react-line-number react-code-text" style="padding-right: 16px;">2</div>
        if (resetLineNumber) {
            $(lineDiv).text($(lineDiv).attr('data-line-number'));
            $(lineDiv).css("padding-right", "16px");
        }
        
        if (resetHover) {
            $(lineDiv).off('mouseenter mouseleave');
        }
    });
}

function changeMode(readOrWriteMode, userName) {
    // 清理读模式数据
    clearAllTips();

    // 先隐藏github边栏， 后续在计算tip div长度的时候才会恰好填满
    if (readOrWriteMode == WRITE_MODE) {
        showRightPanel(true); // 打开github右边边栏
    }
    if (readOrWriteMode == READ_MODE) {
        showRightPanel(false); // 关闭github右边边栏
    }

    // 加载读模式数据
    loadCommentsByAuthor(userName, function() {
        // 数据填充好后， 再设置样式
        if (readOrWriteMode == WRITE_MODE) {
            $('.tip').hide(); // 隐藏全部的注释div，由行号hover触发展示
    
            chrome.storage.local.set({ // 设置读模式，在其他新打开的页面页保持
                read_mode: false
            });
        }
        if (readOrWriteMode == READ_MODE) {
            resetCodeLines(false, true);
            $('.tip').show(); // 显示全部的注释div
            chrome.storage.local.set({ // 设置读模式，在其他新打开的页面页保持
                read_mode: true
            });
        }
    });

   


}

function loadCommentSummary() {
    chrome.runtime.sendMessage(
        {
            action: "queryUserNoteCount",
            data: {
                UserName: currentUserName,
                ...getFileInfo()
            }
        },
        function (response) {
            var arr = response.data.data;
            var options = [];

            options.push('<option user-name="{0}" selected>Write Comments</option>'.format(
                currentUserName
            ));

            if (!arr || arr.length == 0) {
                options.push('<option disabled>{0}</option>'.format('Empty Others'));
            } else {
                for (var comment of arr) {
                    options.push('<option user-name="{0}">Read {1} {2} Comments</option>'.format(
                        comment.user_name,
                        comment.user_name,
                        comment.counts
                    ));
                }
            }

            var firstChild = $('.react-blob-header-edit-and-raw-actions').eq(0).children().eq(0);

            firstChild.prepend(`
                <select id="selectAuthors" data-size="small">
                    {0}
                </select>
            `.format(options.join('')));
            $('#selectAuthors').attr('class', $('#selectAuthors').next().attr('class'));

            $('#selectAuthors').change(function () {
                var selectedOption = $(this).find('option:selected');
                var selected = $(this).val();
                if (selected.indexOf('Read') > -1) { // 读模式
                    changeMode(READ_MODE, $(selectedOption).attr('user-name'));
                } else { // 写模式
                    changeMode(WRITE_MODE, currentUserName);
                }
            });
            $('#selectAuthors').attr('class', $('#selectAuthors').next().attr('class'));
        }
    ); // end send message
}

// 加载注释
function loadCommentsByAuthor(userName, callback) {
    console.log('start request for ' + userName)
    chrome.runtime.sendMessage(
        {
            action: "getNotesByLine",
            data: {
                UserName: userName,
                ...getFileInfo()
            }
        },
        // 从api获取到数据后，填充到页面上
        function (response) {
            var notes_arr = response.data.data;
            all_comment_arr = notes_arr;
            if (!notes_arr || notes_arr.length == 0) {
                console.log('empty comments from ' + userName);
                return;
            }

            $('.react-line-number').each((index, lineDiv) => { // <div data-line-number="2" class="react-line-number react-code-text" style="padding-right: 16px;">2</div>
                for (var item of notes_arr) {
                    var line = item.selected_line;
                    if (line != $(lineDiv).text()) {
                        continue;
                    }
                    if (!item.note || item.note.length <= 0) {
                        continue;
                    }
                    $(lineDiv).text(line + "-c"); // 修改行号显示， xx行号-c表示这行有注释
                    $(lineDiv).css("padding-right", "1px");
                    $(lineDiv).attr('id', 'id-line-' + line);

                    var tipId = 'tip-line-' + line; // 注释使用div包裹， 这个是div的id
                    $('#read-only-cursor-text-area').parent().parent().parent().parent().parent().parent()
                        .append(
                            '<div id="{0}" class="tip" style="display:none; width: {1}px"><table style="width: 100%"><tr><td style="width: 33%"></td><td style="width: 33%"></td><td style="width: 33%;">{2}</td></tr></div>'
                                .format(
                                    tipId,
                                    $('#selectAuthors').parent().parent().parent().parent().width() - 82,
                                    item.note
                                )
                        );
                    line_comment_id_map[line] = tipId;

                    // 设置每个注释div的位置
                    var top = ((parseInt($(lineDiv).attr('data-line-number')) + 1) * 20 + 12) + 'px';
                    $('#' + tipId).css({
                        'top': top,
                        'right': '0px'
                    });
                    // 设置行号hover事件
                    $(lineDiv).hover(
                        function () {
                            $('#' + tipId)
                                .css('width', $('#selectAuthors').parent().parent().parent().parent().width() - 82)
                                .css('color', 'white')
                                .show();
                        },
                        function () {
                            $('#' + tipId)
                                .css('color', 'grey')
                                .hide();
                        }
                    );
                    // 设置注释div hover事件
                    $('#' + tipId).hover(
                        function () {
                            $('#' + tipId)
                                .css('width', $('#selectAuthors').parent().parent().parent().parent().width() - 82)
                                .css('color', 'white');
                        },
                        function () {
                            $('#' + tipId)
                                .css('color', 'grey');
                        }
                    );
                }// end for
            }); // end each

            callback();
        }
    ); // end send message
}