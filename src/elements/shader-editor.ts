import { EditorView, basicSetup } from "codemirror";
import { EditorState } from "@codemirror/state";
import { cpp } from "@codemirror/lang-cpp";
import { ViewUpdate } from "@codemirror/view";
import { GLSLProgram } from "../gl/index.ts";

const THROTTLE_MS = 1000;

function storageKey(sceneId: string, shaderType: string): string {
  return `shader:${sceneId}:${shaderType}`;
}

export class ShaderEditor extends HTMLElement {
  #editorView: EditorView | null = null;
  #program: GLSLProgram | null = null;
  #sceneId = "";
  #activeTab: "vertex" | "fragment" = "fragment";
  #originalSources: Record<string, string> = {};
  #currentSources: Record<string, string> = {};
  #throttleTimer: ReturnType<typeof setTimeout> | null = null;
  #suppressUpdate = false;

  // DOM refs
  #tabsUl!: HTMLUListElement;
  #statusSpan!: HTMLSpanElement;
  #resetButton!: HTMLButtonElement;
  #editorContainer!: HTMLDivElement;
  #errorsDiv!: HTMLDivElement;

  connectedCallback() {
    this.innerHTML = `
      <header class="tabs">
        <ul>
          <li data-shader="vertex">vertex shader</li>
          <li data-shader="fragment" class="active">fragment shader</li>
        </ul>
        <div class="source-actions">
          <span class="source-status" hidden></span>
          <button class="reset-source" hidden>Reset to original</button>
        </div>
      </header>
      <div class="source-code"></div>
      <div class="shader-errors" hidden></div>
    `;

    this.#tabsUl = this.querySelector(".tabs ul")!;
    this.#statusSpan = this.querySelector(".source-status")!;
    this.#resetButton = this.querySelector(".reset-source")!;
    this.#editorContainer = this.querySelector(".source-code")!;
    this.#errorsDiv = this.querySelector(".shader-errors")!;

    this.#editorView = new EditorView({
      state: EditorState.create({
        doc: "",
        extensions: [
          basicSetup,
          cpp(),
          EditorView.updateListener.of((u) => this.#onEditorUpdate(u)),
        ],
      }),
      parent: this.#editorContainer,
    });

    // Tab switching
    this.#tabsUl.addEventListener("click", (e) => {
      const target = (e.target as HTMLElement).closest<HTMLLIElement>(
        "[data-shader]",
      );
      if (!target) return;

      const shaderType = target.dataset.shader as "vertex" | "fragment";
      if (!this.#currentSources[shaderType] || shaderType === this.#activeTab)
        return;

      this.#activeTab = shaderType;
      this.#tabsUl.querySelectorAll("li").forEach((li) => {
        li.classList.toggle("active", li === target);
      });

      this.#setContent(this.#currentSources[this.#activeTab]);
      this.#updateStatus();
    });

    // Reset button
    this.#resetButton.addEventListener("click", () => {
      if (!this.#sceneId) return;

      localStorage.removeItem(storageKey(this.#sceneId, "vertex"));
      localStorage.removeItem(storageKey(this.#sceneId, "fragment"));

      this.#currentSources = { ...this.#originalSources };
      this.#setContent(this.#currentSources[this.#activeTab]);
      this.#updateStatus();
      this.#recompile();
    });
  }

  loadProgram(sceneId: string, program: GLSLProgram) {
    this.#sceneId = sceneId;
    this.#program = program;

    this.#originalSources = {
      vertex: program.vertexShaderSource,
      fragment: program.fragmentShaderSource,
    };

    const storedVs = localStorage.getItem(storageKey(sceneId, "vertex"));
    const storedFs = localStorage.getItem(storageKey(sceneId, "fragment"));

    this.#currentSources = {
      vertex: storedVs ?? this.#originalSources.vertex,
      fragment: storedFs ?? this.#originalSources.fragment,
    };

    // Reset to fragment tab
    this.#activeTab = "fragment";
    this.#tabsUl.querySelectorAll("li").forEach((li) => {
      li.classList.toggle("active", li.dataset.shader === "fragment");
    });

    this.#setContent(this.#currentSources.fragment);
    this.#clearErrors();
    this.#updateStatus();

    // If there are stored modifications, recompile immediately
    if (storedVs || storedFs) {
      this.#recompile();
    }
  }

  #setContent(source: string) {
    if (!this.#editorView) return;
    this.#suppressUpdate = true;
    this.#editorView.dispatch({
      changes: {
        from: 0,
        to: this.#editorView.state.doc.length,
        insert: source,
      },
    });
    this.#suppressUpdate = false;
  }

  #onEditorUpdate(update: ViewUpdate) {
    if (!update.docChanged || this.#suppressUpdate) return;

    this.#currentSources[this.#activeTab] = update.state.doc.toString();
    this.#updateStatus();

    if (this.#throttleTimer) clearTimeout(this.#throttleTimer);
    this.#throttleTimer = setTimeout(() => this.#recompile(), THROTTLE_MS);
  }

  #recompile() {
    if (!this.#program) return;

    const result = this.#program.rebuild({
      vs: this.#currentSources.vertex,
      fs: this.#currentSources.fragment,
    });

    if (result.success) {
      this.#clearErrors();
      this.#persistModified();
    } else {
      this.#errorsDiv.hidden = false;
      this.#errorsDiv.textContent = result.errors.join("\n");
    }
  }

  #persistModified() {
    if (!this.#sceneId) return;

    for (const type of ["vertex", "fragment"] as const) {
      const key = storageKey(this.#sceneId, type);
      if (this.#currentSources[type] !== this.#originalSources[type]) {
        localStorage.setItem(key, this.#currentSources[type]);
      } else {
        localStorage.removeItem(key);
      }
    }
  }

  #isModified(shaderType: string): boolean {
    return this.#currentSources[shaderType] !== this.#originalSources[shaderType];
  }

  #updateStatus() {
    const modified = this.#isModified(this.#activeTab);
    this.#statusSpan.hidden = !modified;
    this.#statusSpan.textContent = "modified";

    this.#resetButton.hidden =
      !this.#isModified("vertex") && !this.#isModified("fragment");
  }

  #clearErrors() {
    this.#errorsDiv.hidden = true;
    this.#errorsDiv.textContent = "";
  }
}

window.customElements.define("shader-editor", ShaderEditor);
