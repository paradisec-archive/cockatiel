import type { Exporter } from '../types';
import { csv } from './csv';
import { eaf } from './eaf';
import { srt } from './srt';
import { text } from './text';
import { textgrid } from './textgrid';

export const ALL_EXPORTERS: readonly Exporter[] = [eaf, srt, textgrid, csv, text];
