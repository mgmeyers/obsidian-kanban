export interface Lane {
  id: string;
  title: string;
  description?: string;
  items: Item[];
}

export interface Item {
  id: string;
  title: string;
  description?: string;
}

export interface Board {
  lanes: Lane[];
}
