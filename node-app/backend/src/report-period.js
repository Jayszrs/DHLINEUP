// Shared report periods are explicit; month-only values never silently become all dates.
export const periodLabel = filters => [filters.from || 'Awal data', filters.to || 'Akhir data'].join(' s.d. ');
