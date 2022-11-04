export interface ISqliteMaster {
    type: string,
    name: string,
    tbl_name: string,
    rootpage: number,
    sql: string,
}