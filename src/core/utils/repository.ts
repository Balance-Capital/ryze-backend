/**
 * @deprecated do not use this dynamic support, write toEntity() method instead
 * @param dto
 * @param data
 * @param fields
 */
export function getFromDto<T>(dto: any, data: any, fields?: string[]): T {
  let properties: string[];
  if (fields && fields.length) {
    properties = fields;
  } else {
    properties = Object.keys(dto);
  }
  properties.forEach((property) => {
    data[property] = dto[property];
  });
  return data;
}
