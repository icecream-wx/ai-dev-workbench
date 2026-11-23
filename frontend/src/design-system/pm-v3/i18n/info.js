import Cookies from 'js-cookie'
const info = [
   {zh:'将文件拖到此处，或CTRL-V粘贴，或者点击上传',en:'Drag the file here, paste it in CTRL-V, or click on upload'},
   {zh:'附件上传',en:'Attachment upload'},
   {zh:'只能上传',en:'Can only upload '},
   {zh:'文件不超过',en:'File size does not exceed'},
   {zh:'文件数量不超过',en:'The number of files does not exceed'},
   {zh:'新窗口预览',en:'New Window Preview'},
   {zh:'附件预览',en:'Attachment Preview'},
   {zh:'上传时间',en:'Upload Time'},
   {zh:'文件名称',en:'File Name'},
   {zh:'最大化',en:'Maximize'},
   {zh:'下载',en:'Download'},
   {zh:'删除',en:'Delete'},
   {zh:'预览',en:'Preview'},
   {zh:'关闭',en:'Close'},
   {zh:'恢复',en:'Restore'},
   {zh:'操作',en:'Operation'},
   {zh:'序号',en:'No.'},
   {zh:'全部数据',en:'All Data'},
   {zh:'编辑',en:'Edit'},
   {zh:'添加',en:'Add'},
   {zh:'请选择树形下拉',en:'Please Select'},
   {zh:'数据加载中',en:'Data loading in progress'},
   {zh:'无数据',en:'No data'},
   {zh:'高级搜索',en:'Advanced Search'},
   {zh:'搜索',en:'Search'},
   {zh:'重置',en:'Reset'},
   {zh:'全部下载',en:'Download all'},
]

const i18n = (key) => {
    if (Cookies.get('language') === 'en_US') {
        const item = info.find(s => s.zh === key)
        if (item) {
            return item.en + ' '
        } else {
            return key
        }
    } else {
        return key
    }
}

export default info
export {
    i18n
}
