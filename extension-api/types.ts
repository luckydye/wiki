// Define types inline since we can't import from the main app
export type ViewRenderFn = (container: HTMLElement) => void | (() => void);

/** The Tiptap editor instance */
export type Editor = any;

export type SuggestionItem = {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  [key: string]: unknown;
};

export type SuggestionProvider = {
  /** Trigger character (e.g., "/" or "#") */
  char: string;
  /** Function to get suggestion items based on the query string */
  items: (query: string) => Promise<SuggestionItem[]> | SuggestionItem[];
  /** Called when a suggestion is selected */
  onSelect: (item: SuggestionItem, editor: Editor) => void;
};

export type ExtensionContext = {
  extensionId: string;
  spaceId: string;
  /** Current extension route path, if rendering a view */
  route: string | null;
  /** The API client. */
  api: any;
  actions: {
    register: (id: string, options: Record<string, any>) => string;
    unregister: (id: string) => void;
  };
  views: {
    /** Register a view renderer for a route path */
    register: (path: string, render: ViewRenderFn) => void;
    unregister: (path: string) => void;
  };
  suggestions: {
    /** Register a suggestion provider with a trigger character */
    register: (id: string, provider: SuggestionProvider) => void;
    unregister: (id: string) => void;
  };
  /** Extension-scoped key-value storage */
  storage: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string) => Promise<void>;
    delete: (key: string) => Promise<void>;
    list: (prefix?: string) => Promise<Array<{ key: string; value: string }>>;
  };
  /** Returns the active editor instance, or null if no editor is active */
  getActiveEditor: () => Editor | null;
};

export interface ExtensionRouteMenuItem {
  title: string;
  icon?: string;
}

export interface ExtensionRoute {
  path: string;
  title?: string;
  description?: string;
  menuItem?: ExtensionRouteMenuItem;
  /** Where this view should be placed. Can include "page" (default) and/or home placements */
  placements?: Array<"page" | "home-top">;
}

export type ExtensionInfo = {
  id: string;
  name: string;
  version: string;
  description?: string;
  entries: {
    frontend?: string;
    view?: string;
  };
  routes?: ExtensionRoute[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type LoadedExtension = {
  info: ExtensionInfo;
  module: ExtensionModule | null;
  viewModule: ExtensionModule | null;
  registeredActions: Set<string>;
  registeredViews: Map<string, ViewRenderFn>;
  viewCleanup: (() => void) | null;
};

export type ExtensionModule = {
  activate?: (ctx: ExtensionContext) => void | Promise<void>;
  deactivate?: (ctx: ExtensionContext) => void | Promise<void>;
};
