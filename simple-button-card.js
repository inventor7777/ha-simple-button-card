const CARD_TYPE = "simple-button-card";
const DEFAULT_ICON_SIZE = 72;
const DEFAULT_TEXT_SIZE = 24;
const DEFAULT_SECONDARY_TEXT_SIZE = 13;
const DEFAULT_TEXT_WEIGHT = 500;
const DEFAULT_SECONDARY_TEXT_WEIGHT = 400;
const DEFAULT_PADDING = 16;
const DEFAULT_GRID_ROWS = 3;
const DEFAULT_GRID_COLUMNS = 3;
const HOLD_DELAY_MS = 500;
const DOUBLE_TAP_DELAY_MS = 250;
const TEMPLATE_KEYS = ["icon", "iconColor", "text", "secondary", "iconSize", "textSize", "secondarySize"];

function createNumberSelector(min, max, step = 1) {
  return {
    number: {
      min,
      max,
      step,
      mode: "box",
    },
  };
}

function getTemplateConfigKey(key) {
  switch (key) {
    case "icon":
      return "icon_template";
    case "iconColor":
      return "icon_color_template";
    case "secondary":
      return "secondary_text_template";
    case "iconSize":
      return "icon_size_template";
    case "textSize":
      return "text_size_template";
    case "secondarySize":
      return "secondary_text_size_template";
    default:
      return "text_template";
  }
}

function getDefaultConfig() {
  return {
    type: `custom:${CARD_TYPE}`,
    entity: "",
    icon_template: "",
    icon_size_template: "",
    icon_attach_top: false,
    icon_padding_top: 0,
    icon_padding_bottom: 0,
    icon_color_template: "",
    text_template: "",
    secondary_text_template: "",
    text_size_template: "",
    text_padding_top: 0,
    text_padding_bottom: 0,
    text_weight: DEFAULT_TEXT_WEIGHT,
    secondary_text_size_template: "",
    secondary_text_padding_top: 0,
    secondary_text_padding_bottom: 0,
    secondary_text_weight: DEFAULT_SECONDARY_TEXT_WEIGHT,
    side_padding: DEFAULT_PADDING,
    secondary_text_above: false,
    grid_options: {
      rows: DEFAULT_GRID_ROWS,
      columns: DEFAULT_GRID_COLUMNS,
    },
    tap_action: {
      action: "more-info",
    },
    hold_action: {
      action: "none",
    },
    double_tap_action: {
      action: "none",
    },
  };
}

function normalizeNumber(value, fallback, min = 0, max = Number.POSITIVE_INFINITY) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function normalizeGridOptions(gridOptions) {
  return {
    rows: normalizeNumber(gridOptions?.rows, DEFAULT_GRID_ROWS, 1, 12),
    columns: normalizeNumber(gridOptions?.columns, DEFAULT_GRID_COLUMNS, 1, 12),
  };
}

function normalizeActionConfig(actionConfig, fallbackAction = "none") {
  if (!actionConfig || typeof actionConfig !== "object" || Array.isArray(actionConfig)) {
    return { action: fallbackAction };
  }

  return {
    ...actionConfig,
    action: String(actionConfig.action || fallbackAction),
  };
}

function formatValueWithUnit(value, unit) {
  if (!unit) return value;

  if (unit === "%" || unit === "‰") {
    return `${value}${unit}`;
  }

  return `${value} ${unit}`;
}

function normalizeBoolean(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (["1", "yes", "on"].includes(normalized)) return true;
    if (["0", "no", "off", ""].includes(normalized)) return false;
  }
  return Boolean(value);
}

function normalizeConfig(config) {
  const defaults = getDefaultConfig();

  return {
    ...defaults,
    ...(config || {}),
    type: `custom:${CARD_TYPE}`,
    entity: String(config?.entity || "").trim(),
    icon_template: String(config?.icon_template || ""),
    icon_size_template: String(config?.icon_size_template || ""),
    icon_attach_top: normalizeBoolean(config?.icon_attach_top, false),
    icon_padding_top: normalizeNumber(config?.icon_padding_top, 0, 0, 48),
    icon_padding_bottom: normalizeNumber(config?.icon_padding_bottom, 0, 0, 48),
    icon_color_template: String(config?.icon_color_template || ""),
    text_template: String(config?.text_template || ""),
    secondary_text_template: String(config?.secondary_text_template || ""),
    text_size_template: String(config?.text_size_template || ""),
    text_padding_top: normalizeNumber(config?.text_padding_top, 0, 0, 48),
    text_padding_bottom: normalizeNumber(config?.text_padding_bottom, 0, 0, 48),
    text_weight: normalizeNumber(config?.text_weight, DEFAULT_TEXT_WEIGHT, 100, 900),
    secondary_text_size_template: String(config?.secondary_text_size_template || ""),
    secondary_text_padding_top: normalizeNumber(config?.secondary_text_padding_top, 0, 0, 48),
    secondary_text_padding_bottom: normalizeNumber(config?.secondary_text_padding_bottom, 0, 0, 48),
    secondary_text_weight: normalizeNumber(
      config?.secondary_text_weight,
      DEFAULT_SECONDARY_TEXT_WEIGHT,
      100,
      900,
    ),
    side_padding: normalizeNumber(config?.side_padding, DEFAULT_PADDING, 0, 48),
    secondary_text_above: normalizeBoolean(config?.secondary_text_above, false),
    grid_options: normalizeGridOptions(config?.grid_options),
    tap_action: normalizeActionConfig(config?.tap_action, "more-info"),
    hold_action: normalizeActionConfig(config?.hold_action, "none"),
    double_tap_action: normalizeActionConfig(config?.double_tap_action, "none"),
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

class SimpleButtonCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._resizeObserver = undefined;
    this._holdTimer = undefined;
    this._tapTimer = undefined;
    this._templateSubscriptions = {};
    this._templateRequestIds = {
      icon: 0,
      iconColor: 0,
      text: 0,
      secondary: 0,
      iconSize: 0,
      textSize: 0,
      secondarySize: 0,
    };
    this._renderedTemplates = {
      icon: "",
      iconColor: "",
      text: "",
      secondary: "",
      iconSize: "",
      textSize: "",
      secondarySize: "",
    };
    this._didHold = false;
    this._lastPointerDown = false;
  }

  static getStubConfig() {
    return {
      entity: "sun.sun",
      icon_template: "",
      icon_size_template: "",
      icon_attach_top: false,
      icon_padding_top: 0,
      icon_padding_bottom: 0,
      text_size_template: "",
      secondary_text_size_template: "",
      text_weight: DEFAULT_TEXT_WEIGHT,
      secondary_text_weight: DEFAULT_SECONDARY_TEXT_WEIGHT,
      side_padding: DEFAULT_PADDING,
      secondary_text_above: false,
      tap_action: {
        action: "more-info",
      },
      hold_action: {
        action: "none",
      },
      double_tap_action: {
        action: "none",
      },
    };
  }

  static getConfigForm() {
    return {
      schema: [
        {
          name: "entity",
          required: false,
          selector: { entity: {} },
        },
        {
          type: "expandable",
          name: "icon_section",
          title: "Icon",
          flatten: true,
          schema: [
            {
              name: "icon_template",
              selector: {
                template: {},
              },
            },
            {
              name: "icon_color_template",
              selector: {
                template: {},
              },
            },
            {
              name: "icon_size_template",
              selector: {
                template: {},
              },
            },
            {
              name: "icon_attach_top",
              selector: { boolean: {} },
            },
            {
              type: "grid",
              name: "",
              flatten: true,
              column_min_width: "140px",
              schema: [
                {
                  name: "icon_padding_top",
                  selector: createNumberSelector(0, 48),
                },
                {
                  name: "icon_padding_bottom",
                  selector: createNumberSelector(0, 48),
                },
              ],
            },
          ],
        },
        {
          type: "expandable",
          name: "title_section",
          title: "Title",
          flatten: true,
          schema: [
            {
              name: "text_template",
              selector: {
                template: {},
              },
            },
            {
              name: "text_size_template",
              selector: {
                template: {},
              },
            },
            {
              name: "text_weight",
              selector: createNumberSelector(100, 900, 100),
            },
            {
              type: "grid",
              name: "",
              flatten: true,
              column_min_width: "140px",
              schema: [
                {
                  name: "text_padding_top",
                  selector: createNumberSelector(0, 48),
                },
                {
                  name: "text_padding_bottom",
                  selector: createNumberSelector(0, 48),
                },
              ],
            },
          ],
        },
        {
          type: "expandable",
          name: "subtext_section",
          title: "Subtext",
          flatten: true,
          schema: [
            {
              name: "secondary_text_template",
              selector: {
                template: {},
              },
            },
            {
              name: "secondary_text_size_template",
              selector: {
                template: {},
              },
            },
            {
              name: "secondary_text_weight",
              selector: createNumberSelector(100, 900, 100),
            },
            {
              type: "grid",
              name: "",
              flatten: true,
              column_min_width: "140px",
              schema: [
                {
                  name: "secondary_text_padding_top",
                  selector: createNumberSelector(0, 48),
                },
                {
                  name: "secondary_text_padding_bottom",
                  selector: createNumberSelector(0, 48),
                },
              ],
            },
            {
              name: "secondary_text_above",
              selector: { boolean: {} },
            },
          ],
        },
        {
          name: "side_padding",
          selector: createNumberSelector(0, 48),
        },
        {
          type: "expandable",
          name: "interactions",
          title: "Interactions",
          flatten: true,
          schema: [
            {
              name: "tap_action",
              selector: { ui_action: {} },
            },
            {
              name: "hold_action",
              selector: { ui_action: {} },
            },
            {
              name: "double_tap_action",
              selector: { ui_action: {} },
            },
          ],
        },
      ],
      computeLabel: (schema) => {
        switch (schema.name) {
          case "icon_template":
            return "Icon / Template";
          case "icon_attach_top":
            return "Attach To Top";
          case "icon_size_template":
            return "Icon Size";
          case "icon_padding_top":
            return "Padding Top";
          case "icon_padding_bottom":
            return "Padding Bottom";
          case "side_padding":
            return "Side Padding";
          case "secondary_text_above":
            return "Sub Text Above";
          case "text_size_template":
            return "Title Size";
          case "text_weight":
            return "Title Weight";
          case "text_padding_top":
            return "Padding Top";
          case "text_padding_bottom":
            return "Padding Bottom";
          case "secondary_text_size_template":
            return "Sub Text Size";
          case "secondary_text_weight":
            return "Sub Text Weight";
          case "secondary_text_padding_top":
            return "Padding Top";
          case "secondary_text_padding_bottom":
            return "Padding Bottom";
          case "icon_color_template":
            return "Icon Color";
          case "text_template":
            return "Title / Template";
          case "secondary_text_template":
            return "Sub Text / Template";
          case "tap_action":
            return "Tap Action";
          case "hold_action":
            return "Hold Action";
          case "double_tap_action":
            return "Double Tap Action";
          default:
            return undefined;
        }
      },
      computeHelper: (schema) => {
        switch (schema.name) {
          case "icon_color_template":
            return "Optional. If this resolves to a color, it overrides state coloring. Leave blank to use Home Assistant state color.";
          case "side_padding":
            return "Horizontal padding for the card content.";
          case "icon_template":
            return "Supports a plain icon like mdi:car or a Jinja template for dynamic icon swapping.";
          case "icon_size_template":
            return "Optional static value or Jinja template for icon size in pixels.";
          case "text_template":
            return "Supports static text or Jinja templates rendered through Home Assistant with native template editing.";
          case "text_size_template":
            return "Optional static value or Jinja template for title size in pixels.";
          case "secondary_text_template":
            return "Optional smaller text shown above or below the main text. Supports static text or Jinja templates.";
          case "secondary_text_size_template":
            return "Optional static value or Jinja template for sub text size in pixels.";
          case "entity":
            return "Optional, but recommended for native icon behavior and more-info actions.";
          default:
            return undefined;
        }
      },
      assertConfig: (config) => {
        if (config && typeof config !== "object") {
          throw new Error("Invalid configuration.");
        }
      },
    };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Invalid configuration");
    }

    this._config = normalizeConfig(config);
    this._updateTemplateSubscription();
    this._render();
  }

  set hass(hass) {
    const previousConnection = this._hass?.connection;
    this._hass = hass;

    if (previousConnection !== hass?.connection) {
      this._updateTemplateSubscription();
    }

    if (!this._usesTemplate("icon")) {
      this._renderedTemplates.icon = this._getDefaultIcon();
    }

    if (!this._usesTemplate("iconColor")) {
      this._renderedTemplates.iconColor = this._getDefaultIconColor();
    }

    if (!this._usesTemplate("text")) {
      this._renderedTemplates.text = this._getDefaultText();
    }

    if (!this._usesTemplate("secondary")) {
      this._renderedTemplates.secondary = this._getDefaultSecondaryText();
    }

    if (!this._usesTemplate("iconSize")) {
      this._renderedTemplates.iconSize = this._getDefaultTemplateValue("iconSize");
    }

    if (!this._usesTemplate("textSize")) {
      this._renderedTemplates.textSize = this._getDefaultTemplateValue("textSize");
    }

    if (!this._usesTemplate("secondarySize")) {
      this._renderedTemplates.secondarySize = this._getDefaultTemplateValue("secondarySize");
    }

    this._render();
  }

  connectedCallback() {
    this._ensureResizeObserver();
    this._render();
  }

  disconnectedCallback() {
    this._clearTimers();
    this._clearTemplateSubscription();
    this._resizeObserver?.disconnect();
    this._resizeObserver = undefined;
  }

  getCardSize() {
    const rows = normalizeGridOptions(this._config?.grid_options).rows;
    return Math.max(1, rows);
  }

  getGridOptions() {
    const grid = normalizeGridOptions(this._config?.grid_options);
    return {
      rows: grid.rows,
      columns: grid.columns,
      min_rows: 1,
      max_rows: 12,
      min_columns: 1,
      max_columns: 12,
    };
  }

  _getStateObject(entityId = this._config?.entity) {
    if (!entityId || !this._hass) return undefined;
    return this._hass.states?.[entityId];
  }

  _getTemplateConfigValue(key) {
    return this._config?.[getTemplateConfigKey(key)] || "";
  }

  _usesTemplate(key = "text") {
    const template = this._getTemplateConfigValue(key);
    return template.includes("{{") || template.includes("{%");
  }

  _clearTemplateSubscription(key) {
    if (key) {
      this._templateRequestIds[key] += 1;

      if (this._templateSubscriptions[key]) {
        this._templateSubscriptions[key]();
        this._templateSubscriptions[key] = undefined;
      }

      return;
    }

    for (const templateKey of TEMPLATE_KEYS) {
      this._templateRequestIds[templateKey] += 1;

      if (this._templateSubscriptions[templateKey]) {
        this._templateSubscriptions[templateKey]();
        this._templateSubscriptions[templateKey] = undefined;
      }
    }
  }

  async _updateTemplateSubscription() {
    if (!this._config) return;

    await Promise.all(TEMPLATE_KEYS.map((templateKey) => this._updateSingleTemplateSubscription(templateKey)));

    this._render();
  }

  async _updateSingleTemplateSubscription(key) {
    this._clearTemplateSubscription(key);

    const template = this._getTemplateConfigValue(key);
    const fallbackValue = this._getDefaultTemplateValue(key);

    if (!this._usesTemplate(key) || !this._hass?.connection) {
      this._renderedTemplates[key] = fallbackValue;
      return;
    }

    const requestId = this._templateRequestIds[key];

    try {
      const unsubscribe = await this._hass.connection.subscribeMessage(
        (message) => {
          if (requestId !== this._templateRequestIds[key]) return;
          this._renderedTemplates[key] = String(message?.result ?? "");
          this._render();
        },
        {
          type: "render_template",
          template,
        },
      );

      if (requestId !== this._templateRequestIds[key]) {
        unsubscribe?.();
        return;
      }

      this._templateSubscriptions[key] = unsubscribe;
    } catch (_error) {
      this._renderedTemplates[key] = template;
    }
  }

  _ensureResizeObserver() {
    if (this._resizeObserver) return;

    this._resizeObserver = new ResizeObserver((entries) => {
      const entry = entries?.[0];
      const rect = entry?.contentRect;
      if (!rect || !this.style) return;

      this.style.setProperty("--simple-button-width", `${rect.width}px`);
      this.style.setProperty("--simple-button-height", `${rect.height}px`);
      this.style.setProperty(
        "--simple-button-compact-scale",
        rect.width < 140 || rect.height < 140 ? "0.86" : "1",
      );
    });

    this._resizeObserver.observe(this);
  }

  _formatDefaultStateValue(stateObj) {
    if (!stateObj) return "";

    const rawState = stateObj.state;
    if (rawState == null || rawState === "" || rawState === "unknown" || rawState === "unavailable") {
      return "";
    }

    const numericValue = Number(rawState);
    const unit = stateObj.attributes?.unit_of_measurement || "";

    if (Number.isFinite(numericValue)) {
      const formatted = Number.isInteger(numericValue)
        ? String(numericValue)
        : String(Number(numericValue.toFixed(2)));
      return formatValueWithUnit(formatted, unit);
    }

    return String(rawState);
  }

  _getDefaultText() {
    const stateObj = this._getStateObject();
    if (this._config?.text_template?.trim() && !this._usesTemplate("text")) {
      return this._config.text_template;
    }

    return this._formatDefaultStateValue(stateObj) || stateObj?.attributes?.friendly_name || "";
  }

  _getDefaultTemplateValue(key) {
    if (key === "icon") {
      return this._getDefaultIcon();
    }

    if (key === "iconColor") {
      return this._getDefaultIconColor();
    }

    if (key === "secondary") {
      return this._getDefaultSecondaryText();
    }

    if (key === "iconSize") {
      return this._getDefaultIconSize();
    }

    if (key === "textSize") {
      return this._getDefaultTextSize();
    }

    if (key === "secondarySize") {
      return this._getDefaultSecondaryTextSize();
    }

    return this._getDefaultText();
  }

  _getDefaultIcon() {
    if (this._config?.icon_template?.trim() && !this._usesTemplate("icon")) {
      return this._config.icon_template.trim();
    }

    return "";
  }

  _getDefaultIconColor() {
    if (this._config?.icon_color_template?.trim() && !this._usesTemplate("iconColor")) {
      return this._config.icon_color_template.trim();
    }

    return "";
  }

  _getDefaultSecondaryText() {
    if (this._config?.secondary_text_template?.trim() && !this._usesTemplate("secondary")) {
      return this._config.secondary_text_template;
    }

    return "";
  }

  _getDefaultIconSize() {
    if (this._config?.icon_size_template?.trim() && !this._usesTemplate("iconSize")) {
      return this._config.icon_size_template.trim();
    }

    return String(DEFAULT_ICON_SIZE);
  }

  _getDefaultTextSize() {
    if (this._config?.text_size_template?.trim() && !this._usesTemplate("textSize")) {
      return this._config.text_size_template.trim();
    }

    return String(DEFAULT_TEXT_SIZE);
  }

  _getDefaultSecondaryTextSize() {
    if (this._config?.secondary_text_size_template?.trim() && !this._usesTemplate("secondarySize")) {
      return this._config.secondary_text_size_template.trim();
    }

    return String(DEFAULT_SECONDARY_TEXT_SIZE);
  }

  _getDisplayText() {
    const templateText = this._renderedTemplates.text?.trim();
    if (templateText) return templateText;
    return this._getDefaultTemplateValue("text");
  }

  _getDisplayIcon() {
    const templateIcon = this._renderedTemplates.icon?.trim();
    if (templateIcon) return templateIcon;
    return this._getDefaultTemplateValue("icon");
  }

  _getDisplayIconColor() {
    const templateColor = this._renderedTemplates.iconColor?.trim();
    if (templateColor) return templateColor;
    return this._getDefaultTemplateValue("iconColor");
  }

  _getDisplaySecondaryText() {
    const templateText = this._renderedTemplates.secondary?.trim();
    if (templateText) return templateText;
    return this._getDefaultTemplateValue("secondary");
  }

  _getDisplayIconSize() {
    const templateSize = this._renderedTemplates.iconSize?.trim();
    return normalizeNumber(templateSize || this._getDefaultTemplateValue("iconSize"), DEFAULT_ICON_SIZE, 12, 256);
  }

  _getDisplayTextSize() {
    const templateSize = this._renderedTemplates.textSize?.trim();
    return normalizeNumber(templateSize || this._getDefaultTemplateValue("textSize"), DEFAULT_TEXT_SIZE, 8, 96);
  }

  _getDisplaySecondaryTextSize() {
    const templateSize = this._renderedTemplates.secondarySize?.trim();
    return normalizeNumber(
      templateSize || this._getDefaultTemplateValue("secondarySize"),
      DEFAULT_SECONDARY_TEXT_SIZE,
      8,
      96,
    );
  }

  _getActionConfig() {
    return {
      entity: this._config?.entity || undefined,
      tap_action: normalizeActionConfig(this._config?.tap_action, "more-info"),
      hold_action: normalizeActionConfig(this._config?.hold_action, "none"),
      double_tap_action: normalizeActionConfig(this._config?.double_tap_action, "none"),
    };
  }

  _dispatchAction(action) {
    if (!action) return;

    this.dispatchEvent(
      Object.assign(new Event("hass-action", { bubbles: true, composed: true }), {
        detail: {
          config: this._getActionConfig(),
          action,
        },
      }),
    );
  }

  _clearTimers() {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = undefined;
    }

    if (this._tapTimer) {
      clearTimeout(this._tapTimer);
      this._tapTimer = undefined;
    }
  }

  _startHold() {
    this._didHold = false;
    this._lastPointerDown = true;
    this._clearTimers();

    if (this._config?.hold_action?.action === "none") return;

    this._holdTimer = window.setTimeout(() => {
      this._holdTimer = undefined;
      this._didHold = true;
      this._dispatchAction("hold");
    }, HOLD_DELAY_MS);
  }

  _cancelHold() {
    this._lastPointerDown = false;
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = undefined;
    }
  }

  _handleTap() {
    if (this._didHold) {
      this._didHold = false;
      return;
    }

    if (this._config?.double_tap_action?.action && this._config.double_tap_action.action !== "none") {
      if (this._tapTimer) {
        clearTimeout(this._tapTimer);
        this._tapTimer = undefined;
        this._dispatchAction("double_tap");
        return;
      }

      this._tapTimer = window.setTimeout(() => {
        this._tapTimer = undefined;
        this._dispatchAction("tap");
      }, DOUBLE_TAP_DELAY_MS);
      return;
    }

    this._dispatchAction("tap");
  }

  _attachEvents(button) {
    if (!button) return;

    button.addEventListener("pointerdown", () => this._startHold());
    button.addEventListener("pointerup", () => this._cancelHold());
    button.addEventListener("pointerleave", () => this._cancelHold());
    button.addEventListener("pointercancel", () => this._cancelHold());
    button.addEventListener("click", () => this._handleTap());
  }

  _getIconRenderData(stateObj) {
    const icon = this._getDisplayIcon();
    const iconSize = this._getDisplayIconSize();
    const iconColorOverride = this._getDisplayIconColor();
    const useStateColor = !iconColorOverride;
    const styleParts = [
      `--mdc-icon-size: calc(${iconSize}px * var(--simple-button-compact-scale, 1));`,
      `width: calc(${iconSize}px * var(--simple-button-compact-scale, 1));`,
      `height: calc(${iconSize}px * var(--simple-button-compact-scale, 1));`,
    ];

    if (iconColorOverride) {
      styleParts.push(`color: ${iconColorOverride};`);
    } else if (!useStateColor) {
      styleParts.push("color: var(--primary-text-color);");
    }

    if (stateObj) {
      return {
        tagName: "state-badge",
        className: `icon${useStateColor ? " icon--state-color" : ""}`,
        style: styleParts.join(" "),
        icon,
      };
    }

    return {
      tagName: "ha-icon",
      className: "icon",
      style: styleParts.join(" "),
      icon: icon || "mdi:radiobox-blank",
    };
  }

  _ensureBaseStructure() {
    if (!this.shadowRoot || this.shadowRoot.querySelector("#button")) return;

    this.shadowRoot.innerHTML = `
      <ha-card>
        <button id="button" class="button" type="button">
          <div class="content">
            <div class="icon-wrap"></div>
            <div class="text-wrap">
              <div class="text-stack">
                <div class="text"></div>
                <div class="secondary-text" hidden></div>
              </div>
            </div>
          </div>
        </button>
      </ha-card>
      <style>
        :host {
          display: block;
          height: 100%;
          --simple-button-compact-scale: 1;
          --state-inactive-color: var(--state-icon-color);
        }

        ha-card {
          display: block;
          height: 100%;
          overflow: hidden;
          border-radius: var(--ha-card-border-radius, 18px);
          background: var(--ha-card-background, var(--card-background-color, white));
          box-shadow: var(--ha-card-box-shadow, var(--shadow-elevation-2dp_-_box-shadow));
        }

        .button {
          display: block;
          width: 100%;
          height: 100%;
          min-height: 100%;
          padding: 0;
          margin: 0;
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          text-align: inherit;
          font: inherit;
        }

        .button:focus-visible {
          outline: 2px solid var(--primary-color);
          outline-offset: -2px;
        }

        .content {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          align-items: stretch;
          height: 100%;
          min-height: 100%;
          padding:
            0
            calc(var(--simple-button-side-padding) * var(--simple-button-compact-scale, 1))
            0
            calc(var(--simple-button-side-padding) * var(--simple-button-compact-scale, 1));
          box-sizing: border-box;
          gap: calc(5px * var(--simple-button-compact-scale, 1));
        }

        .icon-wrap {
          flex: 1 1 auto;
          display: flex;
          align-items: var(--simple-button-icon-align, center);
          justify-content: center;
          min-height: 0;
          padding:
            calc(var(--simple-button-icon-padding-top) * var(--simple-button-compact-scale, 1))
            0
            calc(var(--simple-button-icon-padding-bottom) * var(--simple-button-compact-scale, 1))
            0;
          box-sizing: border-box;
        }

        .icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        }

        .text-wrap {
          flex: 0 0 auto;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          min-height: 0;
        }

        .text-stack {
          width: 100%;
          display: flex;
          flex-direction: var(--simple-button-text-stack-direction, column);
          align-items: center;
          justify-content: center;
          gap: 0;
        }

        .text {
          width: 100%;
          text-align: center;
          padding:
            calc(var(--simple-button-text-padding-top) * var(--simple-button-compact-scale, 1))
            0
            calc(var(--simple-button-text-padding-bottom) * var(--simple-button-compact-scale, 1))
            0;
          box-sizing: border-box;
          font-size: calc(var(--simple-button-text-size) * var(--simple-button-compact-scale, 1));
          line-height: 1.1;
          font-weight: var(--simple-button-text-weight);
          color: var(--primary-text-color);
          word-break: break-word;
        }

        .secondary-text {
          width: 100%;
          text-align: center;
          padding:
            calc(var(--simple-button-secondary-text-padding-top) * var(--simple-button-compact-scale, 1))
            0
            calc(var(--simple-button-secondary-text-padding-bottom) * var(--simple-button-compact-scale, 1))
            0;
          box-sizing: border-box;
          font-size: calc(var(--simple-button-secondary-text-size) * var(--simple-button-compact-scale, 1));
          line-height: 1;
          font-weight: var(--simple-button-secondary-text-weight);
          color: var(--secondary-text-color);
          word-break: break-word;
        }
      </style>
    `;

    this._attachEvents(this.shadowRoot.querySelector("#button"));
  }

  _updateIcon(stateObj) {
    const iconWrap = this.shadowRoot?.querySelector(".icon-wrap");
    if (!iconWrap) return;

    const iconData = this._getIconRenderData(stateObj);
    const renderSignature = JSON.stringify({
      tagName: iconData.tagName,
      className: iconData.className,
      style: iconData.style,
      icon: iconData.icon,
    });
    let iconEl = this.shadowRoot?.querySelector("#icon");

    if (
      !iconEl
      || iconEl.tagName.toLowerCase() !== iconData.tagName
      || iconEl.dataset.renderSignature !== renderSignature
    ) {
      iconEl?.remove();
      iconEl = document.createElement(iconData.tagName);
      iconEl.id = "icon";
      iconWrap.replaceChildren(iconEl);
    }

    iconEl.dataset.renderSignature = renderSignature;
    iconEl.className = iconData.className;
    iconEl.setAttribute("style", iconData.style);

    if (iconData.tagName === "ha-icon") {
      iconEl.icon = iconData.icon;
      iconEl.setAttribute("icon", iconData.icon);
      return;
    }

    this._applyStateIconProperties(stateObj);
  }

  _applyStateIconProperties(stateObj) {
    const iconEl = this.shadowRoot?.querySelector("#icon");
    if (!iconEl || !stateObj) return;

    iconEl.hass = this._hass;
    iconEl.stateObj = stateObj;
    iconEl.stateColor = !this._getDisplayIconColor();
    iconEl.overrideIcon = this._getDisplayIcon() || undefined;
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;

    this._ensureBaseStructure();

    const stateObj = this._getStateObject();
    const displayText = this._getDisplayText();
    const displaySecondaryText = this._getDisplaySecondaryText();
    const sidePadding = normalizeNumber(this._config.side_padding, DEFAULT_PADDING, 0, 48);
    const iconAttachTop = normalizeBoolean(this._config.icon_attach_top, false);
    const iconPaddingTop = iconAttachTop
      ? 0
      : normalizeNumber(this._config.icon_padding_top, 0, 0, 48);
    const iconPaddingBottom = iconAttachTop
      ? 0
      : normalizeNumber(this._config.icon_padding_bottom, 0, 0, 48);
    const textSize = this._getDisplayTextSize();
    const textPaddingTop = normalizeNumber(this._config.text_padding_top, 0, 0, 48);
    const textPaddingBottom = normalizeNumber(this._config.text_padding_bottom, 0, 0, 48);
    const textWeight = normalizeNumber(this._config.text_weight, DEFAULT_TEXT_WEIGHT, 100, 900);
    const secondaryTextSize = this._getDisplaySecondaryTextSize();
    const secondaryTextPaddingTop = normalizeNumber(this._config.secondary_text_padding_top, 0, 0, 48);
    const secondaryTextPaddingBottom = normalizeNumber(this._config.secondary_text_padding_bottom, 0, 0, 48);
    const secondaryTextWeight = normalizeNumber(
      this._config.secondary_text_weight,
      DEFAULT_SECONDARY_TEXT_WEIGHT,
      100,
      900,
    );
    const secondaryTextAbove = normalizeBoolean(this._config.secondary_text_above, false);
    const button = this.shadowRoot.querySelector("#button");
    const textEl = this.shadowRoot.querySelector(".text");
    const secondaryTextEl = this.shadowRoot.querySelector(".secondary-text");

    button?.setAttribute(
      "style",
      `
        --simple-button-side-padding: ${sidePadding}px;
        --simple-button-icon-padding-top: ${iconPaddingTop}px;
        --simple-button-icon-padding-bottom: ${iconPaddingBottom}px;
        --simple-button-icon-align: ${iconAttachTop ? "flex-start" : "center"};
        --simple-button-text-size: ${textSize}px;
        --simple-button-text-padding-top: ${textPaddingTop}px;
        --simple-button-text-padding-bottom: ${textPaddingBottom}px;
        --simple-button-text-weight: ${textWeight};
        --simple-button-secondary-text-size: ${secondaryTextSize}px;
        --simple-button-secondary-text-padding-top: ${secondaryTextPaddingTop}px;
        --simple-button-secondary-text-padding-bottom: ${secondaryTextPaddingBottom}px;
        --simple-button-secondary-text-weight: ${secondaryTextWeight};
        --simple-button-text-stack-direction: ${secondaryTextAbove ? "column-reverse" : "column"};
      `,
    );
    button?.setAttribute("aria-label", displayText || stateObj?.attributes?.friendly_name || "Button");

    if (textEl) {
      textEl.textContent = displayText || " ";
    }

    if (secondaryTextEl) {
      secondaryTextEl.textContent = displaySecondaryText || "";
      secondaryTextEl.hidden = !displaySecondaryText;
    }

    this._updateIcon(stateObj);
  }
}

if (!customElements.get(CARD_TYPE)) {
  customElements.define(CARD_TYPE, SimpleButtonCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card?.type === CARD_TYPE)) {
  window.customCards.push({
    type: CARD_TYPE,
    name: "Simple Button Card",
    preview: false,
    description: "A compact centered icon button with template text and native Home Assistant actions.",
  });
}
