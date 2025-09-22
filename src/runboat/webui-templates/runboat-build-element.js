import {LitElement, html, css} from 'https://esm.run/lit@2.1.2?module';
import 'https://esm.run/@github/time-elements@latest?module';

class RunboatBuildElement extends LitElement {
    static get properties() {
        return {
            build: {},
            showLogModal: { type: Boolean },
            showInitLogModal: { type: Boolean }
        }
    }

    constructor() {
        super();
        this.build = {};
        this.showLogModal = false;
        this.showInitLogModal = false;
        this.logRefreshInterval = null;
        this.initLogRefreshInterval = null;
    }

    undeployed() {
        this.build = {...this.build, status: null};
    }

    static styles = css`
        .build-card {
            width: 16.5em;
            height: 8em;
            padding: 0.5em;
            border-radius: 0.5em;
            background-color: lightgray;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
        }
        .build-name {
            font-size: x-small;
        }
        .build-status-stopped {
            background-color: paleturquoise;
        }
        .build-status-started {
            background-color: palegreen;
        }
        .build-status-failed {
            background-color: lightcoral;
        }
        time-ago {
            color: gray;
            white-space: nowrap;
        }
        p {
            margin-top: 0.5em;
            margin-bottom: 0.5em;
            font-size: small;
        }
        .build-info {
            flex-grow: 1;
            overflow: hidden;
        }
        .build-actions {
            margin-top: auto;
        }
        .log-link {
            cursor: pointer;
            color: blue;
            text-decoration: underline;
        }
        .log-link:hover {
            color: darkblue;
        }
        
        /* Modal styles */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }
        .modal-content {
            background-color: white;
            border-radius: 0.5em;
            width: 90%;
            max-width: 800px;
            height: 80%;
            display: flex;
            flex-direction: column;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .modal-header {
            padding: 1em;
            border-bottom: 1px solid #ddd;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .modal-title {
            font-weight: bold;
            font-size: 1.2em;
        }
        .modal-close {
            background: none;
            border: none;
            font-size: 1.5em;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
        }
        .modal-body {
            flex-grow: 1;
            padding: 1em;
            overflow: auto;
        }
        .log-content {
            font-family: monospace;
            font-size: 0.9em;
            white-space: pre-wrap;
            background-color: #f8f9fa;
            padding: 1em;
            border-radius: 0.25em;
            max-height: 100%;
            overflow: auto;
        }
        .loading {
            text-align: center;
            padding: 2em;
            color: #666;
        }
    `;

    render() {
        if (!this.build.name) {
            return html`<div class="build-card"><p>Build not found...</p></div>`;
        }
        return html`
        <div class="build-card build-status-${this.build.status}">
            <div class="build-info">
                <p class="build-name">${this.build.name}</p>
                <p>
                    <a href="${this.build.repo_target_branch_link}">${this.build.commit_info?.repo}/${this.build.commit_info?.target_branch}</a>
                    ${this.build.commit_info?.pr?
                        html`PR <a href="${this.build.repo_pr_link}">${this.build.commit_info?.pr}</a>`:""
                    }
                    ${this.build.commit_info?.git_commit?
                        html`(<a href="${this.build.repo_commit_link}">${this.build.commit_info?.git_commit.substring(0, 8)}</a>)`:""
                    }
                    <time-ago datetime="${this.build.created}"></time-ago>
                </p>
                <p>
                    ${this.build.status || "undeployed"}
                    ${this.build.status?
                        html`⦙ 🗒 <span class="log-link" @click="${this.showInitLog}">init log</span>`:""
                    }
                    ${this.build.status == "started"?
                        html`⦙ 🗒 <span class="log-link" @click="${this.showLog}">log</span>`:""
                    }
                    ${this.build.status == "started"?
                       html`⦙ 🚪 <a href="${this.build.deploy_link}" title="Odoo" target="_blank">live</a> ⦙ <a href="${this.build.deploy_link_mailhog}" title="Mailhog" target="_blank">✉</a>`:""
                    }
                </p>
            </div>
            <div class="build-actions">
                <p>
                    <button @click="${this.startHandler}" ?disabled="${this.build.status != "stopped" || this.build.status == RunboatBuildElement.clickedStatus}">start</button>
                    <button @click="${this.stopHandler}" ?disabled="${this.build.status != "started" || this.build.status == RunboatBuildElement.clickedStatus}">stop</button>
                    <button @click="${this.resetHandler}" ?disabled="${this.build.status == RunboatBuildElement.clickedStatus}">reset</button>
                    <button @click="${this.deleteHandler}" ?disabled="${this.build.status == RunboatBuildElement.clickedStatus}">delete</button>
                </p>
            </div>
        </div>
        
        ${this.showLogModal ? html`
            <div class="modal-overlay" @click="${this.closeModal}">
                <div class="modal-content" @click="${this.stopPropagation}">
                    <div class="modal-header">
                        <div class="modal-title">Build Log - ${this.build.name}</div>
                        <button class="modal-close" @click="${this.closeModal}">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="log-content" class="log-content">
                            <div class="loading">Loading log...</div>
                        </div>
                    </div>
                </div>
            </div>
        ` : ''}

        ${this.showInitLogModal ? html`
            <div class="modal-overlay" @click="${this.closeInitLogModal}">
                <div class="modal-content" @click="${this.stopPropagation}">
                    <div class="modal-header">
                        <div class="modal-title">Init Log - ${this.build.name}</div>
                        <button class="modal-close" @click="${this.closeInitLogModal}">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="init-log-content" class="log-content">
                            <div class="loading">Loading init log...</div>
                        </div>
                    </div>
                </div>
            </div>
        ` : ''}
        `;
    }

    showLog(e) {
        e.preventDefault();
        this.showLogModal = true;
        this.requestUpdate();
        
        // Fetch log content after modal is rendered
        this.updateComplete.then(() => {
            this.fetchLogContent();
            // Start auto-refresh every 5 seconds
            this.logRefreshInterval = setInterval(() => {
                this.fetchLogContent();
            }, 5000);
        });
    }

    showInitLog(e) {
        e.preventDefault();
        this.showInitLogModal = true;
        this.requestUpdate();
        
        // Fetch init log content after modal is rendered
        this.updateComplete.then(() => {
            this.fetchInitLogContent();
            // Start auto-refresh every 5 seconds
            this.initLogRefreshInterval = setInterval(() => {
                this.fetchInitLogContent();
            }, 5000);
        });
    }

    closeModal() {
        this.showLogModal = false;
        // Clear the refresh interval when modal is closed
        if (this.logRefreshInterval) {
            clearInterval(this.logRefreshInterval);
            this.logRefreshInterval = null;
        }
        this.requestUpdate();
    }

    closeInitLogModal() {
        this.showInitLogModal = false;
        // Clear the refresh interval when modal is closed
        if (this.initLogRefreshInterval) {
            clearInterval(this.initLogRefreshInterval);
            this.initLogRefreshInterval = null;
        }
        this.requestUpdate();
    }

    stopPropagation(e) {
        e.stopPropagation();
    }

    async fetchLogContent() {
        const logContentElement = this.shadowRoot.getElementById('log-content');
        if (!logContentElement) return; // Modal might be closed
        
        try {
            const response = await fetch(`/api/v1/builds/${this.build.name}/log`);
            if (response.ok) {
                const htmlText = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                const preElement = doc.querySelector('pre.ansi2html-content');
                
                if (preElement) {
                    logContentElement.innerHTML = preElement.innerHTML;
                    // Auto-scroll to bottom to show latest log entries
                    logContentElement.scrollTop = logContentElement.scrollHeight;
                } else {
                    logContentElement.textContent = htmlText || 'Log is empty';
                }
            } else {
                logContentElement.textContent = `Error loading log: ${response.status} ${response.statusText}`;
            }
        } catch (error) {
            logContentElement.textContent = `Error loading log: ${error.message}`;
        }
    }

    async fetchInitLogContent() {
        const initLogContentElement = this.shadowRoot.getElementById('init-log-content');
        if (!initLogContentElement) return; // Modal might be closed
        
        try {
            const response = await fetch(`/api/v1/builds/${this.build.name}/init-log`);
            if (response.ok) {
                const htmlText = await response.text();
                const parser = new DOMParser();
                const doc = parser.parseFromString(htmlText, 'text/html');
                const preElement = doc.querySelector('pre.ansi2html-content');
                
                if (preElement) {
                    initLogContentElement.innerHTML = preElement.innerHTML;
                    // Auto-scroll to bottom to show latest log entries
                    initLogContentElement.scrollTop = initLogContentElement.scrollHeight;
                } else {
                    initLogContentElement.textContent = htmlText || 'Init log is empty';
                }
            } else {
                initLogContentElement.textContent = `Error loading init log: ${response.status} ${response.statusText}`;
            }
        } catch (error) {
            initLogContentElement.textContent = `Error loading init log: ${error.message}`;
        }
    }

    startHandler(e) {
        this.actionHandler("start");
    }

    stopHandler(e) {
        this.actionHandler("stop");
    }

    resetHandler(e) {
        this.actionHandler("reset");
    }

    deleteHandler(e) {
        this.build.status = RunboatBuildElement.clickedStatus;
        this.requestUpdate();
        fetch(`/api/v1/builds/${this.build.name}`, {method: 'DELETE'});
    }

    static clickedStatus = "⏳";

    actionHandler(action) {
        this.build.status = RunboatBuildElement.clickedStatus;
        this.requestUpdate();
        fetch(`/api/v1/builds/${this.build.name}/${action}`, {method: 'POST'});
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        // Clean up intervals when component is removed
        if (this.logRefreshInterval) {
            clearInterval(this.logRefreshInterval);
        }
        if (this.initLogRefreshInterval) {
            clearInterval(this.initLogRefreshInterval);
        }
    }
}

export {RunboatBuildElement};