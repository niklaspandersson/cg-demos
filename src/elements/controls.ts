import { ParameterDescriptor } from "../gl";

const toRGB = (hex: string) => {
  const hex2float = (start: number, end: number) => parseInt(hex.substring(start, end), 16) / 255;

  const r = hex2float(1, 3);
  const g = hex2float(3, 5);
  const b = hex2float(5, 7);
  return [r, g, b];
}

const toId = (title: string) => title.toLowerCase().replace(/\s/g, '-');

export function toControl(param: ParameterDescriptor) {
  const el = document.createElement('li');
  const { title } = param;
  const id = toId(title);

  if (param.type === 'color') {
    el.innerHTML = `<label for="${id}">${title}:</label>
      <input type="color" id="${id}" name="${id}" value="#ff0000">`
  } else if (param.type === 'number') {
    const min = param.min || 0;
    const max = param.max || 1;
    const step = param.step || (max - min) / 100;
    const value = param.initial ?? (min + max) / 2;

    el.innerHTML = `<label for="${id}">${title}:</label>
    <input type="range" id="${id}" name="${id}" value="${value}" min="${min}" max="${max}" step="${step}">`
  }
  else if (param.type === 'boolean') {
    el.innerHTML = `<label for="${id}">${title}:</label>
    <input type="checkbox" id="${id}" name="${id}">`
  }

  if (param.type === 'color') {
    el.querySelector('input')?.addEventListener('input', (e: Event) => {
      let value: any = (e.target as HTMLInputElement).value;
      param.update(toRGB(value));
    });
  }
  else {
    el.querySelector('input')?.addEventListener('change', (e: Event) => {
      if (param.type === 'boolean') {
        param.update((e.target as HTMLInputElement).checked);
      }
      else if (param.type === 'number') {
        param.update((e.target as HTMLInputElement).value);
      }
    });
  }

  return el;
}