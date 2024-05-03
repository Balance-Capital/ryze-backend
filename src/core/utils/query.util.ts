export function parseSortQuery(sortQuery?: string, tableName?: string): any {
  const result = {};
  if (sortQuery) {
    const queryList = (sortQuery || '').split(',');
    queryList.map((query: string) => {
      if (query.split(':')[0] && query.split(':')[1]) {
        result[query.split(':')[0]] = query.split(':')[1];
      }
    });
  }
  if (tableName) {
    result[`${tableName}.updatedAt`] = 'DESC';
  }
  return result;
}
