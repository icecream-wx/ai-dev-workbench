<template>
  <div class="ocr">
    <el-upload
      :disabled="isFormEdit"
      ref="uploadOCR"
      action=""
      :limit="1"
      accept=""
      :on-change="handleFileChange"
      :file-list="fileList"
      :auto-upload="false"
      :http-request="handleHttpRequest"
      :show-file-list="false"
    >
      <el-button v-if="!showUpload" class="uploadBtn disabledBtn">请设置识别内容</el-button>
      <div v-else>
        <el-button class="uploadBtn" @click="triggerUpload('idCradBack')" v-if="backSide">识别身份证人像面</el-button>
        <el-button class="uploadBtn" @click="triggerUpload('IdCardRight')" v-if="rightSide">识别身份证国徽面</el-button>
        <el-button class="uploadBtn" @click="triggerUpload()" v-if="type!=='idCard'">识别{{ labelList[type] }}</el-button>
      </div>
    </el-upload>
  </div>
</template>

<script>
import { cloneDeep } from 'lodash';
import { localStore } from '../../utils/sessionStore'
import { useDispatchProxy, useControllers } from '../../composables/useDispatchProxy'

/**
 * OCR 文字识别组件，上传图片并调用 OCR 接口识别图片中的文字内容
 */
export default {
  name: 'OCR',
  props: {
    ocrSetting: {
      type: Object,
      default: () => ({}),
    },
    formData: {
      type: Object,
      default: () => ({})
    },
    OCRType: {
      type: String,
      default: ''
    },
    OCRFields: {
      type: Array,
      default: () => []
    }
  },
  data() {
    return {
      fileList: [],
      ocrObject: {},
      peopleSide: '',
      triggeringButton: '',
      idCardBackFields: ['peopleSide', 'name', 'sex', 'ethnicity', 'birthDate', 'address', 'idNumber'],
      idCardRightFields: ['logoSide', 'issueAuthority', 'validPeriod'],
      labelList: {
        bankCard: '银行卡',
        invoice: '发票',
        businessLicense: '营业执照',
        drivingLicense: '驾驶证',
        vehicleLicense: '行驶证',
        trainTicket: '火车票',
        generalCharacter: '识别文字'
      }
    }
  },
  computed: {
    isExpress() {
      const globalConfig = localStore.get('globalConfig')
      return !!(globalConfig && globalConfig.isExpress)
    },
    dispatchProxy() {
      const { dispatchProxy } = useDispatchProxy(this)
      return dispatchProxy
    },
    Controllers() {
      return useControllers(this)
    },
    type() {
      return this.OCRType || (this.ocrSetting && this.ocrSetting.type)
    },
    isFormEdit() {
      return this.OCRType !== '' || this.type === '' || this.type === null || this.type === undefined;
    },
    fields() {
      return this.OCRFields || this.ocrSetting.fields
    },
    showUpload() {
      return this.type && this.fields && this.fields.length > 0
    },
    backSide() {
      if (this.showUpload && (this.OCRType || this.ocrSetting.type)) {
        let arr = this.OCRFields || this.ocrSetting.fields
        return arr.some(item => this.idCardBackFields.includes(item.ocrValue))
      } else {
        return false
      }
    },
    rightSide() {
      if (this.showUpload && (this.OCRType || this.ocrSetting.type)) {
        let arr = this.OCRFields || this.ocrSetting.fields
        return arr.some(item => this.idCardRightFields.includes(item.ocrValue))
      } else {
        return false
      }
    }
  },
  methods: {
    async handleFileChange(file, fileList) {
      if (this.showUpload) {
        this.$refs.uploadOCR.submit()
      }
    },
    async handleHttpRequest(obj) {
      const params = new FormData()
      params.append('multipartFile', obj.file)
      params.append('type', this.ocrSetting.type)
      const res = await this.dispatchProxy(this.Controllers.LowcodeOCRGeneralController.generalOCR, params)
      if (!res.error) {
        this.ocrObject = res.data.ocrObject
        this.dataProcess(obj)
      }
    },
    async toUploadFile(obj) {
      let params = new FormData()
      params.append("attachments", obj.file)
      const resp = await this.dispatchProxy(this.Controllers.LowcodeModelController.uploadAttachments, params)
      if (!resp.error && resp.data) {
        const fileId = resp.data[0].fileId
        return {
          fileId: fileId,
          valueObject: resp.data[0]
        }
      }
    },
    triggerUpload(button) {
      this.fileList = []
      this.triggeringButton = button
    },
    dataProcess(obj) {
      let newFormData = cloneDeep(this.formData)
      if (this.type === 'idCard') {
        if (this.triggeringButton == 'idCradBack') {
          this.ocrSetting.fields.forEach(async ocrItem => {
            if (newFormData.hasOwnProperty(ocrItem.ocrField) && this.idCardBackFields.includes(ocrItem.ocrValue)) {
              newFormData[ocrItem.ocrField] = this.ocrObject[ocrItem.ocrValue]
              if (ocrItem.ocrValue === 'peopleSide') {
                let { fileId, valueObject } = await this.toUploadFile(obj)
                newFormData[ocrItem.ocrField] = fileId
                newFormData[`__${ocrItem.ocrField}Object`] = valueObject
              }
            }
          })
        } else if (this.triggeringButton == 'IdCardRight') {
          this.ocrSetting.fields.forEach(async ocrItem => {
            if (newFormData.hasOwnProperty(ocrItem.ocrField) && this.idCardRightFields.includes(ocrItem.ocrValue)) {
              newFormData[ocrItem.ocrField] = this.ocrObject[ocrItem.ocrValue]
              if (ocrItem.ocrValue === 'logoSide') {
                let { fileId, valueObject } = await this.toUploadFile(obj)
                newFormData[ocrItem.ocrField] = fileId
                newFormData[`__${ocrItem.ocrField}Object`] = valueObject
              }
            }
          })
        }
      } else {
        this.ocrSetting.fields.forEach(async ocrItem => {
          if (this.type === 'generalCharacter') {
            if (newFormData.hasOwnProperty(ocrItem.ocrField)) {
              if (ocrItem.ocrValue === 'originalCopy') {
                let { fileId, valueObject } = await this.toUploadFile(obj)
                newFormData[ocrItem.ocrField] = fileId
                newFormData[`__${ocrItem.ocrField}Object`] = valueObject
              }
              if (ocrItem.ocrValue === 'content') {
                let str = ''
                this.ocrObject.pages[0].lines.forEach(item => {
                  if (item.type === 'text') {
                    str = item.text + str
                  }
                })
                newFormData[ocrItem.ocrField] = str
              }
            }
          } else {
            if (newFormData.hasOwnProperty(ocrItem.ocrField)) {
              if (ocrItem.ocrValue === 'originalCopy') {
                let { fileId, valueObject } = await this.toUploadFile(obj)
                newFormData[ocrItem.ocrField] = fileId
                newFormData[`__${ocrItem.ocrField}Object`] = valueObject
              } else if (ocrItem.ocrValue === 'products') {
                newFormData[ocrItem.ocrField] = this.transformData(this.ocrObject.products, this.ocrSetting.products.productsTableData);
              } else {
                newFormData[ocrItem.ocrField] = this.ocrObject[ocrItem.ocrValue]
              }
            }
          }
        })
      }
      this.$emit("update:formData", newFormData)
    },
    transformData(dataArray, mappingArray) {
      const mapping = mappingArray.reduce((acc, item) => {
        acc[item.ocrValue] = item.ocrField;
        return acc;
      }, {});
      return dataArray.map(item => {
        const newObj = {};
        for (const key in item) {
          if (mapping[key]) {
            newObj[mapping[key]] = item[key];
          }
        }
        return newObj;
      });
    }
  }
}
</script>
<style lang="scss" scoped>
.ocr {
  :deep(.el-upload) {
    width: 100%;
  }
  .uploadBtn {
    width: 100%;
    margin: 5px
  }
  .disabledBtn {
    background-color: #fff;
    border-color: #ebeef5;
    color: #c0c4cc;
  }
}
</style>
