<template>
    <div class="pm-upload" ref="upload">
        <div v-if="isInChildren" class="children-upload-wrap" :class="{ 'has-children-download': showBatchDownloadButton && !mixEditable }">
            <el-popover
                @hide="hidePop"
                v-for="attachment in enrichedValueObject"
                :key="`attachment-${attachment.fileId}`"
                placement="bottom"
                trigger="hover"
                popper-class="popper-class custom-popover"
                width="480"
                :disabled="mode === 'edit'"
                transition='none'
                :open-delay="500"
            >
                <div>
                    <el-row
                        class="el-upload-list__item is-success">
                        <el-col :span="mixEditable? 22 : 23" style="height: 28px;line-height: 28px;display: flex;align-items: center; padding-left: 16px;">
                            <img :src="attachment.src" alt="" class="svgicon">
                            <span style="margin-left: 12px;font-size: 12px;" :class="{'previewAble': attachment.isPreviewAble}" @click="preview(attachment)">{{ attachment.fileName }}</span>
                        </el-col>
                        <el-col :span="1" class="action">
                            <a v-if="isOss" :title="i18n('下载')" class="list_download fr" href="#" @click.prevent="downloadOssFile(attachment.fileName)">
                                <el-icon style="vertical-align: middle;"><Download /></el-icon>
                            </a>
                            <a v-else :title="i18n('下载')" class="list_download fr" :href="getFileUrl(attachment.fileId) + headersParam">
                                <el-icon style="vertical-align: middle;"><Download /></el-icon>
                            </a>
                        </el-col>
                        <el-col :span="1" v-if="mixEditable && attachment.isShowDelete" class="action">
                            <el-icon class="show-close" @click.stop="removeAttachment(attachment)"><Close /></el-icon>
                        </el-col>
                    </el-row>
                </div>
                <template #reference>
                <span :class="{'one_row': !multiple,'dis_block': isViewVertical}">
                    <img
                        :src="attachment.src"
                        alt=""
                        class="svgicon pl-5 mr-5">
                    <span v-if="!multiple || isViewVertical">{{attachment.fileName}}</span>
                </span>
                </template>
            </el-popover>
            <el-popover
                v-if="mixEditable"
                @hide="hidePop"
                @show="showPop"
                @after-enter="stopClick"
                placement="top"
                trigger="click"
                popper-class="popper-class1"
                width="100%"
                v-model:visible="visible"
                content=""
                transition='none'
                class="fr">
                <el-upload
                    ref="upload"
                    :class="{'notButton': listType!== 'button' || listType!== 'table'}"
                    :drag="uploadType === 'drag'"
                    :disabled="!mixEditable"
                    :headers="headers"
                    :listType="listType"
                    :accept="accept"
                    :multiple="multiple"
                    :http-request="uploadFile"
                    :on-exceed="exceed"
                    :on-success="success"
                    :on-error="error"
                    :on-remove="removeAttachment"
                    :on-change="change"
                    :before-upload="beforeAvatarUpload"
                    :file-list="[]"
                    :show-file-list="false"
                >
                    <div class="upload-drag-area">
                        <el-icon class="upload-icon"><Upload /></el-icon>
                        <div class="el-upload__text">
                            {{ i18n('将文件拖到此处，或CTRL-V粘贴，或者点击上传') }}
                        </div>
                    </div>
                    <template #tip>
                        <UploadTips  :accept="accept" :fileSize="fileSize" :sizeUnit="sizeUnit" :showProgress="showProgress"
                        :progressPercent="progressPercent"
                        :importStatus="importStatus"
                        />
                    </template>
                </el-upload>
                <el-row
                    v-for="attachment in enrichedValueObject"
                    :key="`attachment-${attachment.fileId}`"
                    class="el-upload-list__item is-success">
                    <el-col :span="mixEditable? 22 : 23" style="height: 28px;line-height: 28px;display: flex;align-items: center; padding-left: 16px;">
                        <img :src="attachment.src" alt="" class="svgicon">
                        <span style="margin-left: 12px;font-size: 12px;" :class="{'previewAble': attachment.isPreviewAble}" @click="preview(attachment)">{{ attachment.fileName }}</span>
                    </el-col>
                    <el-col :span="1" class="action">
                        <a v-if="isOss" :title="i18n('下载')" class="list_download fr" href="#" @click.prevent="downloadOssFile(attachment.fileName)">
                                <el-icon style="vertical-align: middle;"><Download /></el-icon>
                            </a>
                        <a v-else :title="i18n('下载')" class="list_download fr" :href="getFileUrl(attachment.fileId) + headersParam">
                            <el-icon style="vertical-align: middle;"><Download /></el-icon>
                        </a>
                    </el-col>
                    <el-col :span="1" v-if="mixEditable && attachment.isShowDelete" class="action">
                        <el-icon class="show-close" @click.stop="removeAttachment(attachment)"><Close /></el-icon>
                    </el-col>
                </el-row>
                <template #reference><el-button type="text"> <el-icon><Paperclip /></el-icon></el-button></template>
            </el-popover>
            <el-button
                v-if="showBatchDownloadButton && !mixEditable"
                type="text"
                class="children-download-all-btn"
                :disabled="isBatchDownloading"
                @click="handleBatchDownloadClick"
            >
                <el-icon><Download /></el-icon>
                <span>{{ i18n('全部下载') }}</span>
            </el-button>
        </div>
        <div v-else-if="mode === 'edit'" :class="{'mode-edit': insideApprovalOpinion, 'collapse-upload-box': isCollapseUploadText}">
            <div class="upload-action-row" :class="{ 'inside-approval-opinion': insideApprovalOpinion }">
            <el-popover
                width="480"
                @hide="hidePop"
                @show="showPop"
                placement="top"
                popper-class="custom-popover"
                v-model:visible="visible"
                trigger="click"
                content="">
                <el-upload
                    ref="upload"
                    v-if="mixEditable && (multiple || !multiple && !valueObject.length || !listType || listType === 'button')"
                    :class="{notButton: listType!== 'button' || listType!== 'table'}"
                    :drag="uploadType === 'drag'"
                    :disabled="!mixEditable"
                    :headers="headers"
                    :listType="listType"
                    :accept="accept"
                    :multiple="multiple"
                    :http-request="uploadFile"
                    :on-exceed="exceed"
                    :on-success="success"
                    :on-error="error"
                    :on-remove="removeAttachment"
                    :on-change="change"
                    :before-upload="beforeAvatarUpload"
                    :file-list="[]"
                    :show-file-list="false"
                >
                    <div class="upload-drag-area">
                        <el-icon class="upload-icon"><Upload /></el-icon>
                        <div class="el-upload__text">
                            {{ i18n('将文件拖到此处，或CTRL-V粘贴，或者点击上传') }}
                        </div>
                    </div>
                    <template #tip>
                        <UploadTips :accept="accept" :fileSize="fileSize" :sizeUnit="sizeUnit" :showProgress="showProgress"
                        :progressPercent="progressPercent"
                        :importStatus="importStatus"
                        />
                    </template>
                </el-upload>
                <transition-group v-if="listType === 'list'" name="fade" mode="none" tag="div">
                    <el-row
                        v-for="attachment in enrichedValueObject"
                        :key="`attachment-${attachment.fileId}`"
                        class="el-upload-list__item is-success"
                        :style="listStyle"
                    >
                        <el-col :span="22">
                            <img :src="getSrc(attachment)" alt="" class="svgicon">
                            <span>{{ attachment.fileName }}</span>
                        </el-col>
                        <el-col :span="2" class="action">
                            <template  v-if="allowDownload">
                            <a
                                v-if="attachment.isShowEdit"
                                :title="i18n('编辑')"
                                class="list_download"
                                href="#"
                                @click.prevent="openFile(attachment.fileId, 'edit')"
                            >
                                <el-icon><Edit /></el-icon>
                            </a>
                            <a
                                v-if="isOss"
                                class="list_download fr"
                                href="#"
                                @click.prevent="downloadOssFile(attachment.fileName)"
                            >
                                <el-icon><Download /></el-icon>
                            </a>
                            <a
                                v-else
                                class="list_download fr"
                                :href="getFileUrl(attachment.fileId) + headersParam"
                            >
                                <el-icon><Download /></el-icon>
                            </a>


                            </template>
                            <el-icon
                                v-if="mixEditable && attachment.isShowDelete"
                                class="show-close"
                                @click.stop="removeAttachment(attachment)"
                            ><Close /></el-icon>
                        </el-col>
                        <!-- <div class="file-name" v-if="mode === 'edit'">
                          <el-tooltip :content="attachment.fileName || attachment.name">
                            <span>
                              {{ shortFileName(attachment.fileName || attachment.name) }}
                            </span>
                          </el-tooltip>
                        </div> -->
                    </el-row>
                </transition-group>
                <el-table
                    ref="dragTable"
                    row-key="fileId"
                    :style="{ display: listType === 'table' && visible ? 'block' : 'none' }"
                    :data="enrichedValueObject"
                    stripe
                    border
                  style="width: 100%"
                    class="mt-5">
                    <el-table-column
                        width="80"
                        prop="date"
                        :label="i18n('序号')">
                        <template #default="scope">
                            {{ scope.$index + 1 }}
                        </template>
                    </el-table-column>
                    <el-table-column
                        v-for="(column, index ) in columns"
                        :key="index"
                        :prop="column.prop"
                        :label="i18n(column.label)">
                        <template #default="{row}">
                            <span v-if="column.prop === 'fileSize'">
                                {{ Math.ceil(row.fileSize / 1024) + 'KB' }}
                            </span>
                            <span v-else>{{ row[column.prop] }}</span>
                        </template>
                    </el-table-column>
                    <el-table-column
                        prop="address"
                        :label="i18n('操作')"
                        min-width="100px">
                        <template #default="scope">
                            <a
                                class="table_download"
                                @click="preview(scope.row)"
                                v-if="showPreview"
                            >
                                {{i18n('预览')}}
                            </a>
                            <a
                                v-if="scope.row.isShowEdit"
                                class="table_download"
                                href="#"
                                @click.prevent="openFile(scope.row.fileId, 'edit')"
                            >
                                {{i18n('编辑')}}
                            </a>
                            <a  
                                v-if="isOss"
                                class="table_download"
                                href="#"
                                @click.prevent="downloadOssFile(scope.row.fileName)"
                            >
                                {{i18n('下载')}}
                            </a>
                            <a
                                v-else
                                class="table_download"
                                :href="getFileUrl(scope.row.fileId) + headersParam"
                            >
                                {{i18n('下载')}}
                            </a>
                            <el-button
                                v-if="mixEditable && scope.row.isShowDelete"
                                @click.prevent="removeAttachment(scope.row)"
                                type="text"
                                style="font-size:14px;"
                                size="small">
                                {{i18n('删除')}}
                            </el-button>
                        </template>
                    </el-table-column>
                </el-table>
                <transition-group v-if="listType === 'picture'" name="fade" mode="none" tag="div">
                    <div
                        v-for="attachment in enrichedValueObject"
                        :key="`attachment-${attachment.fileId}`"
                        class="thumbnail mt-5 mr-10"
                        :style="fileStyle"
                    >
                        <el-icon
                            v-if="mixEditable && attachment.isShowDelete"
                            class="close"
                            @click.stop="removeAttachment(attachment)"
                        ><Close /></el-icon>
                        <template v-if="isImage(attachment.fileType)">
                            <el-image
                                :style="fileStyle"
                                class="attachment-img"
                                fit="scale-down"
                                :src="getFileUrl(attachment.fileId) + headersParam"
                                :preview-src-list="attachmentsImages"
                            >
                            <template #error>
                                <img src="" class="attachment-img" alt="" >
                            </template>
                            </el-image>
                        </template>
                        <div v-else class="attachment-other">
                            <!-- <div class="body">文件</div> -->
                            <div :class="`footer file-${attachment.fileType}`">
                                <!-- <el-link
                                  v-if="isText(attachment.fileType)"
                                  class="view"
                                  icon="el-icon-view"
                                  @click="openView(attachment)"
                                /> -->
                                <a
                                    v-if="attachment.isShowEdit"
                                    class="edit"
                                    href="#"
                                    @click.prevent="openFile(attachment.fileId, 'edit')"
                                >
                                    <el-icon><Edit /></el-icon>
                                </a>
                                <a
                                    v-if="isOss"
                                    class="download"
                                    href="#"
                                    @click.prevent="downloadOssFile(attachment.fileName)"
                                >
                                    <el-icon><Download /></el-icon>
                                </a>
                                <a
                                    v-else
                                    class="download"
                                    :href="getFileUrl(attachment.fileId) + headersParam"
                                >
                                    <el-icon><Download /></el-icon>
                                </a>
                            </div>
                        </div>
                        <div class="file-name" v-if="mode === 'edit'">
                            <el-tooltip :content="attachment.fileName || attachment.name">
                                <span>
                                    {{ shortFileName(attachment.fileName || attachment.name) }}
                                </span>
                            </el-tooltip>
                        </div>
                    </div>
                </transition-group>
                <!-- 审批意见内应用图标 -->
                <template #reference>
                    <div v-if="insideApprovalOpinion" class="btn-edit">
                        <el-tooltip content="点击上传附件" placement="top">
                            <pm-icon value='shangchuan' />
                        </el-tooltip>
                    </div>
                    <el-button v-else-if="!(optionTemplateIsEnable && (mixEditable && ((multiple ? true : valueObject.length < 1) || listType === 'button')))" type="primary" plain style="font-weight: bold;margin-top: 2px;padding-left: 10px;" v-show="mixEditable && isShowUpload">
                        <img src="" style="margin-right: 7px;" alt="">&ensp;{{ i18n('附件上传') }}
                    </el-button>
                </template>
            </el-popover>
            <el-button
                v-if="showBatchDownloadButton"
                type="text"
                class="download-all-btn"
                :disabled="isBatchDownloading"
                @click="handleBatchDownloadClick"
            >
                <el-icon><Download /></el-icon>
                <span>{{ i18n('全部下载') }}</span>
            </el-button>
            </div>

            <draggable v-if="listType === 'picture' && valueObject.length" v-model="valueObject" item-key="fileId" tag="div" v-show="!visible" class="thumbnail-list" @end="savaSort">
                <template #item="{ element }">
                    <div class="thumbnail mt-5 mr-10" style="cursor: move" :style="fileStyle">
                        <el-icon
                            v-if="mixEditable && getIsShowDelete(element)"
                            class="close"
                            @click.stop="removeAttachment(element)"
                        ><Close /></el-icon>
                        <template v-if="isImage(element.fileType)">
                            <el-image
                                v-if="multiple"
                                :style="fileStyle"
                                class="attachment-img"
                                fit="scale-down"
                                :src="getFileUrl(element.fileId) + headersParam"
                                :preview-src-list="attachmentsImages"
                            >
                            <template #error>
                                <div class="image-slot">
                                    <img src="" class="attachment-img" alt="" >
                                </div>
                            </template>
                            </el-image>
                            <el-image
                                v-else
                                :fit="fit"
                                :style="imgStyle"
                                class="attachment-img"
                                :src="getFileUrl(element.fileId) + headersParam"
                                :preview-src-list="attachmentsImages"
                            >
                            <template #error>
                                <div class="image-slot">
                                    <img src="" :style="imgStyle" alt="" >
                                </div>
                            </template>
                            </el-image>
                        </template>
                        <div v-else class="attachment-other">
                            <div :class="`footer file-${element.fileType}`">
                                <a
                                    v-if="isEditableFile(element.fileName)"
                                    class="edit"
                                    href="#"
                                    @click.stop.prevent="openFile(element.fileId, 'edit')"
                                >
                                    <el-icon><Edit /></el-icon>
                                </a>
                                <a
                                    v-if="isOss"
                                    class="download"
                                    href="#"
                                    @click.stop.prevent="downloadOssFile(element.fileName)"
                                >
                                    <el-icon><Download /></el-icon>
                                </a>
                                <a
                                    v-else
                                    class="download"
                                    :href="getFileUrl(element.fileId) + headersParam"
                                >
                                    <el-icon><Download /></el-icon>
                                </a>
                            </div>
                        </div>
                        <div class="file-name" v-if="mode === 'edit' && isShowFileName">
                            <el-tooltip :content="element.fileName || element.name">
                                <span>
                                    {{ shortFileName(element.fileName || element.name) }}
                                </span>
                            </el-tooltip>
                        </div>
                    </div>
                </template>
            </draggable>
            <draggable v-if="listType === 'list' && valueObject.length" v-model="valueObject" item-key="fileId" tag="div" class="mode-edit-list" v-show="!visible" @end="savaSort">
                <template #item="{ element }">
                    <el-row style="cursor: move" class="el-upload-list__item is-success" :style="listStyle">
                        <el-col class="attachment-col" :span="mixEditable ? (insideApprovalOpinion ? 21 : 22) : (insideApprovalOpinion ? 22 : 23)" style="height: auto;line-height: 28px;display: flex;align-items: center; padding-left: 1px;">
                            <img :src="getSrc(element)" alt="" class="svgicon">
                            <div v-if="insideApprovalOpinion" class="attachment-card ml-5">
                                <div style="font-size: 12px; white-space:pre-wrap;" class="ellipsis" :class="{'previewAble': isPreviewType(element.fileName)}" @click="preview(element)">{{ element.fileName }}</div>
                                <div style="font-size: 12px; color: #999;" class="ml-5" >{{ generateSize(element) }}</div>
                            </div>
                            <span v-else style="margin-left: 12px;font-size: 12px; white-space:pre-wrap;" class="ellipsis" :class="{'previewAble': isPreviewType(element.fileName)}" @click="preview(element)">{{ element.fileName }}</span>
                        </el-col>
                        <el-col :span="1" v-if="allowDownload" class="action">
                            <a v-if="isEditableFile(element.fileName)" :title="i18n('编辑')" class="list_download" style="padding-right:0; " href="#" @click.prevent="openFile(element.fileId, 'edit')">
                                <el-icon style="vertical-align: middle;"><Edit /></el-icon>
                            </a>
                            <a v-if="isOss" :title="i18n('下载')" class="list_download fr" style="padding-right:0; " href="#" @click.prevent="downloadOssFile(element.fileName)">
                                <el-icon style="vertical-align: middle;"><Download /></el-icon>
                            </a>
                            <a v-else :title="i18n('下载')" class="list_download fr" style="padding-right:0; " :href="getFileUrl(element.fileId) + headersParam">
                                <el-icon style="vertical-align: middle;"><Download /></el-icon>
                            </a>
                        </el-col>
                        <el-col :span="1" v-if="mixEditable && getIsShowDelete(element)" class="action">
                            <el-icon class="show-close" @click.stop="removeAttachment(element)"><Close /></el-icon>
                        </el-col>
                    </el-row>
                </template>
            </draggable>
            <el-table
                ref="dragTable"
                row-key="fileId"
                 :class="{ hidden: visible }"
                v-if="listType === 'table'"
                :data="enrichedValueObject"
                stripe
                border
              style="width: 100%;cursor: move"
                class="mt-5">
                <el-table-column
                    width="80"
                    prop="date"
                    :label="i18n('序号')">
                    <template #default="scope">
                        {{ scope.$index + 1 }}
                    </template>
                </el-table-column>
                <el-table-column
                    v-for="(column, index ) in columns"
                    :key="index"
                    :prop="column.prop"
                    :label="i18n(column.label)">
                    <template #default="{row}">
                        <span v-if="column.prop === 'fileSize'">
                            {{ Math.ceil(row.fileSize / 1024) + 'KB' }}
                        </span>
                        <span v-else>{{ row[column.prop] }}</span>
                    </template>
                </el-table-column>
                <el-table-column
                    prop="address"
                    :label="i18n('操作')"
                    min-width="100px">
                    <template #default="scope">
                        <a
                            v-if="scope.row.isPreviewAble && showPreview"
                            class="table_download"
                            @click="preview(scope.row)"
                        >
                            {{i18n('预览')}}
                        </a>
                        <a
                            v-if="scope.row.isShowEdit"
                            class="table_download"
                            href="#"
                            @click.prevent="openFile(scope.row.fileId, 'edit')"
                        >
                            {{i18n('编辑')}}
                        </a>
                        <a 
                            v-if="isOss"
                            class="table_download"
                            href="#"
                            @click.prevent="downloadOssFile(scope.row.fileName)"
                        >
                            {{i18n('下载')}}
                        </a>
                        <a
                            v-else
                            class="table_download"
                            :href="getFileUrl(scope.row.fileId) + headersParam"
                        >
                            {{i18n('下载')}}
                        </a>
                        <el-button
                            v-if="mixEditable && scope.row.isShowDelete"
                            @click.prevent="removeAttachment(scope.row)"
                            type="text"
                            style="font-size:14px;"
                            size="small">
                            {{i18n('删除')}}
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </div>
        <div v-else  :class="{'collapse-upload-box': isCollapseUploadText}">
            <div v-for="attachment in enrichedValueObject" :key="attachment.fileId">
                <div style="display: flex;align-items: center;">
                    <img :src="getSrc(attachment)" alt="" class="svgicon">
                    <span class="one_row">
                      {{ attachment.fileName }}
                    </span>
                    <a :title="i18n('预览')" v-if="attachment.isPreviewAble && showPreview" class="list_download fr" @click="preview(attachment)">
                        <el-icon><Search /></el-icon>
                    </a>
                    <a
                        v-if="isOss"
                        :title="i18n('下载')"
                        class="download"
                        href="#"
                        @click.prevent="downloadOssFile(attachment.fileName)"
  
                    >
                        <el-icon><Download /></el-icon>
                    </a>
                    <a
                        v-else
                        :title="i18n('下载')"
                        class="download"
                        :href="getFileUrl(attachment.fileId) + headersParam"
                    >
                        <el-icon><Download /></el-icon>
                    </a>
                </div>
            </div>
        </div>
        <div class="mask" v-if="isActive"></div>
        <div v-if="isActive" class="preview-dialog" :class="{'active': isActive, 'full-screen': fullScreen}">
            <div class="header">
                <span>{{i18n('附件预览')}}</span>
                <div class="operation-btns">
                    <div :title="i18n('最大化')" v-if="fullScreen === false" class="full-screen-btn" @click="handleFullScreen(true)"></div>
                    <el-icon :title="i18n('恢复')" v-else style="margin-right: 10px;" @click="handleFullScreen(false)"><CopyDocument /></el-icon>
                    <el-icon :title="i18n('新窗口预览')" style="margin-right: 10px;" @click="openNewWindow"><Edit /></el-icon>
                    <el-icon :title="i18n('关闭')" @click="isActive = false;fullScreen = false;"><Close /></el-icon>
                </div>
            </div>
            <div class="content">
                <OfficeContent :query="{
                    ...currentFile,
                    previewUrl,
                    previewType,
                    previewServerUrl
                }"/>
            </div>
        </div>
        <el-input :model-value="modelValue" style="display:none;"/>
    </div>
</template>
<script>
import Sortable from "sortablejs";
import { isArray } from "lodash";
import { i18n } from '../../i18n/info'
import Util from "./util.js";
import { localStore } from '../../utils/sessionStore'
import { findAppName, getQueryVariable, setParentOverflow } from "../../utils/util"
// 预览接入：ali-oss 体积大，只有 isOss 模式才需要，改为按需动态 import
// import OSS from "ali-oss"
import { Upload, Download, Close, Edit, Paperclip, Search, CopyDocument } from '@element-plus/icons-vue'
import { OFFICE_FILE_LIST } from './const.js'
import common from "./mixins/common.js";
import api from "./mixins/api.js";
import batchDownload from "./mixins/batchDownload.js";
import collaboraFile from "./mixins/collabora-file.js";
import UploadTips from './components/uploadTips.vue';
import draggable from 'vuedraggable'
/**
 * 文件上传组件
 * @component pm-upload
 * @description 支持单文件/多文件上传，支持拖拽、粘贴上传，支持列表/表格/图片三种展示模式，支持文件预览、下载、编辑、排序功能
 * @example 基础单文件上传 - <pm-upload v-model="fileId" />
 * @example 多文件上传（列表模式） - <pm-upload v-model="fileIds" multiple listType="list" />
 * @example 拖拽上传（图片模式） - <pm-upload v-model="imageIds" multiple uploadType="drag" listType="picture" accept="image/*" />
 * @example 限制文件类型和大小 - <pm-upload v-model="fileId" accept=".pdf,.doc,.docx" :fileSize="10" sizeUnit="MB" />
 * @example 表格模式展示 - <pm-upload v-model="fileIds" multiple listType="table" :columns="uploadColumns" />
 */
export default {
    name: "pm-upload",
    components: {
        Upload,
        Download,
        Close,
        Edit,
        Paperclip,
        Search,
        CopyDocument,
        draggable,
        UploadTips,
        OfficeContent: () => import('./office.vue')
    },
    mixins: [api, common, batchDownload, collaboraFile],
    props: {
        settings: {
            default: () => {},
        },
        fileStyle: {
            default: "",
        },
        listStyle: {
            default: "",
        },
        headers: {
            type: Object,
            default: () => ({}),
        },
        uploadType: {
            type: String,
            default: 'button'
        },
        listType: {
            type: String,
            default: '',
        },
        mode: {
            default: "edit",
        },
        showAcceptText: {
            default:true,
        },
        showPreview: {
            default:true,
        },
        accept: {},
        fileSize: {},
        sizeUnit: {},
        modelValue: {},
        readonly: {
            default: false,
        },
        disabled: {
            default: false,
        },
        isLimitImgWidthHeight: {
            default: false,
        },
        limitImgWidth: {
          default: ''  
        },
        limitImgHeight: {
            default: ''
        },
        buttonConfig:{
            type: Object,
            default: () => {
                return {
                    size:'mini',
                    text:'点击上传'
                }
            }
        },
        fileUrl: {
            type: Function,
            default: (id) => `/api/lowcode/models/attachments/${id}/actions/download`,
        },
        entityModel: {
            default: null
        },
        multiple: {
            type: Boolean,
            default: false
        },
        isInChildren: {
            type: Boolean,
            default: false
        },
        // 允许下载
        allowDownload: {
            type: Boolean,
            default: true
        },
        columns: {
            type: Array,
            default: () => {
                return [{
                    label: '文件名称',
                    prop: 'fileName',
                },{
                    label: '文件大小',
                    prop: 'fileSize',
                },{
                    label: '创建时间',
                    prop: 'createTime',
                }]
            }
        },
        // 是否在审批意见框中
        insideApprovalOpinion: {
            type: Boolean,
            default: false
        },
        filePath: {
            default: "",
        },
        isOss:{
            type: Boolean,
            default: false
        },
        fit:{
            default: "",
        },
        imgWidth: {
            type:  [Number,String] ,
            default: 80,
        },
        imgHeight: {
            type:  [Number,String] ,
            default: 80,
        },
        showFileName: {
            type: Boolean,
            default: true
        },
        optionTemplateIsEnable:{
            type: Boolean,
            default: false,
        },
        isViewVertical: {//视图中竖显示
            type: Boolean,
            default: false,
        },
        previewType: {
            default: "",
        },
        previewServerUrl: {
            default: "",
        },
        isTextWrap: {//视图中竖显示
            type: Boolean,
            default: false,
        },
        uploadBizType: {
            default: ""
        }
    },
    computed: {
        isCollapseUploadText() {
            return !this.isTextWrap
        },
        enrichedValueObject() {
            return this.valueObject
                .filter(attachment => attachment && !(attachment instanceof Promise) && typeof attachment === 'object' && typeof attachment?.fileId !== 'undefined')
                .map((attachment) => {
                return {
                    ...attachment,
                    src: this.getSrc(attachment),
                    isShowDelete: this.getIsShowDelete(attachment),
                    isPreviewAble: this.isPreviewType(attachment.fileName),
                    isShowEdit: this.isEditableFile(attachment.fileName),
                }
            });
        },
        customPreviewUrlStr() {
            const { previewUrl, previewType } = localStore.get('globalConfig') || {}
            const customPreviewType =  previewType || this.previewType
            const customPreviewUrl = previewUrl || this.previewServerUrl
            if(!customPreviewUrl || customPreviewType !== 'custom') {
                return 
            }
            if(customPreviewUrl.indexOf('?')!==-1) {
                return customPreviewUrl + '&'
            } else {
                return customPreviewUrl + '?'
            }
        },
        officeServerUrl() {
            const { officeServerUrl } = localStore.get('globalConfig') || {}
            return officeServerUrl || (this.previewType === 'OnlyOffice' && this.previewUrl)
        },
        imgStyle() {
            return {
                width: this.isInChildren ? '50px' : (this.isCorrect(this.imgWidth) ? this.imgWidth : this.imgWidth + 'px'),
                height: this.isInChildren ? '50px' :(this.isCorrect(this.imgHeight) ? this.imgHeight : this.imgHeight + 'px'),
                'object-fit': this.fit
            }
        },
        motionHeight () {
            if (this.visible && !this.isInChildren) {
                return '168px'
            }else {
                return 'auto'
            }
        },
        attachmentsImages() {
            return this.valueObject
                .filter((item) => Util.isImage(item.fileType))
                .map((item) => this.getFileUrl(item.fileId) + this.headersParam);
        },
        headersParam() {
            const headers = this.headers || {}
            const keys = Object.keys(headers)
            if (!keys.length) return ''
            return `?${keys
                .map((key) => { 
                    if(key === 'Authorization' && headers[key] && headers[key].indexOf('afc-token:')!==-1) {
                        const auth = headers[key].replace('{', '').replace('}', '')
                        return `${key}=${auth}`
                    } else {
                        return `${key}=${headers[key]}`
                    }
                    
                })
                .join("&")}`;
        },
        isShowUpload() {
            const limit = this.$attrs.limit
            return this.multiple && (limit && this.valueObject.length < limit || !limit) || !this.multiple && !this.valueObject.length || !this.listType || this.listType === 'button'
        },
        mixEditable() {
            return !(this.readonly || this.disabled) && this.mode === "edit";
        },
        isPreviewFileAddPathname(){
            const globalConfig = localStore.get('globalConfig') // 读取全局配置
            if (globalConfig && globalConfig.isPreviewFileAddPathname) {
                return true
            }else{
                return false
            }
        },
        isShowFileName(){
            if(this.listType === 'picture'){
                return this.showFileName
            }else {
                return true
            }
        }
    },
    data() {
        return {
            newClient: null,
            expirationTime: null,
            progressPercent: 0,
            importStatus: '',
            showProgress: false,
            isImage: Util.isImage,
            isVideo: Util.isVideo,
            isText: Util.isText,
            isExcel: Util.isExcel,
            isAudio: Util.isAudio,
            isPdf: Util.isPdf,
            isPpt: Util.isPpt,
            isWord: Util.isWord,
            valueObject: [],
            sortable: null,
            showContent: '',
            visible: false,
            uploadStatus: false,
            isActive: false,
            beforeUploadParams: {},
            currentFileType: 'VueOfficeDocx',
            previewUrl: '',
            fullScreen: false,
            currentFile: null,
            i18n,
        };
    },
    mounted() {
        window.addEventListener('paste', this.pasteFile)
        document.addEventListener('mousedown', this.handlePopoverMousedown);
        if (this.listType === 'table') {
            this.initSortable()
        }

    },
    beforeUnmount(){
        this.hidePop()
        if (this.sortable && this.sortable.destroy) {
            this.sortable.destroy()
            this.sortable = null
        }
        document.removeEventListener('mousedown', this.handlePopoverMousedown);
        window.removeEventListener('paste', this.pasteFile)
        window.removeEventListener('click', this.hideUploadBox)
    },
    watch: {
        // entityModel(val) {
        //     debugger
        //     this.updateValueObject(val);
        // },
        modelValue: {
            immediate: true,
            handler: function(val) {
                this.init()
            }
        },
        mode(val){
            if(val === 'view'){
                this.isInChildren && setParentOverflow(true)
            }
        }
    },
    methods: {
        async init() {
           if(this.modelValue && this.getObjectIsEmpty(this.entityModel)) {
                const resp = await this.getFileInfo(this.modelValue)
                const entityModel = this.multiple ? resp : resp[0] 
                this.$emit('update:entityModel', entityModel)
                this.updateValueObject(entityModel)
            } else if(!this.modelValue){
                this.updateValueObject([]);
            } else if(this.modelValue && this.entityModel) {
                this.updateValueObject(this.entityModel)
            }
        },
        handlePopoverMousedown(e) {
            const popover = document.querySelector('.el-popover.popper-class1');
            if (this.visible && popover?.contains(e.target)) {
                e.stopPropagation();
            } else {
                this.hideUploadBox();
            }
        },
        updateValueObject(val) {
            if (isArray(val)) {
                this.valueObject = val.filter(item => item && typeof item === 'object' && !(item instanceof Promise));
                this.showContent = this.valueObject.map(i => i.fileName).join(',');
            } else if (val && val.fileId && !(val instanceof Promise)) {
                this.valueObject = [val];
                this.showContent = val.fileName;
            } else {
                this.valueObject = [];
                this.showContent = '';
            }
        },
       
        isCorrect(data){
            return (data+"").indexOf('px')!==-1 || (data+"").indexOf('%')!==-1
        },
        initSortable() {
            if (this.listType !== 'table' || this.visible) return;
            if (this.sortable && this.sortable.destroy) {
                this.sortable.destroy();
            }
            this.$nextTick(() => {
                const tbody = this.$refs.dragTable?.$el?.querySelector('.el-table__body > tbody');
                if (tbody) {
                this.sortable = Sortable.create(tbody, {
                    animation: 150,
                    onEnd: ({ newIndex, oldIndex }) => {
                        const currRow = this.valueObject.splice(oldIndex, 1)[0];
                        this.valueObject.splice(newIndex, 0, currRow);
                        this.savaSort();
                    },
                });
                }
            });

        },
        savaSort() {
            let data = data = [
                ...this.valueObject,
            ]
            const ids = data.map(i => i.fileId).join(',')
            this.$emit("update:modelValue", ids)
        },
        stopClick() {
            document.querySelectorAll('.el-popover.popper-class1').forEach(item => {
                item.addEventListener('mousedown', (e) => {
                    e.stopPropagation()
                })
            })
            window.addEventListener('click', this.hideUploadBox)
        },
        hideUploadBox() {
            this.visible = false
        },
        showPop(){
            window.removeEventListener('click', this.hideUploadBox)
            this.visible = true;
        },
        hidePop() {
            // this.isInChildren && setParentOverflow(true)
            return false;
        },
        handleFullScreen(bol) {
            this.fullScreen = bol
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'))
            }, 100)
            this.isActive = true
        },
        renderedHandler(...args) {
            console.log('success', ...args)
        },
        errorHandler(...args) {
            console.log('error----', args)
        },
        // 按配置的预览服务分流，未配置时保留原有预览方式。
        async preview(file) {
            this.currentFile = file
            const previewService = this.getPreviewServiceByFileName(file.fileName)
            if (Array.isArray(this.previewServices) && this.previewServices.length) {
                if (!previewService) {
                    await this.openOfficePreviewWindow()
                    return
                }
                if (previewService.type === 'Collabora') {
                    this.openFile(file.fileId, 'view')
                    return
                }
                if (previewService.type === 'custom') {
                    await this.openCustomPreviewUrl(previewService)
                    return
                }
                await this.openOfficePreviewWindow(previewService)
                return
            }
            if(this.customPreviewUrlStr) {
                await this.openCustomPreviewUrl({
                    url: this.customPreviewUrlStr,
                })
                return
            }
            const customPreview = this.$attrs.onCustomPreview
            if(customPreview) {
                const previewUrl = await this.getTempFileUrlApi(file)
                this.$emit('customPreview', {
                    file,
                    previewUrl
                })
                return
            }
            if(this.previewType === 'Collabora'){
                this.openFile(file.fileId, 'view')
                return
            }
            if (!this.isPreviewType(file.fileName) || !this.showPreview) {
                return
            }
            await this.openOfficePreviewWindow()
        },

        // 通过统一预览页打开附件，并传递选中的服务配置。
        async openOfficePreviewWindow(previewService) {
            this.isActive = false;
            this.fullScreen = false;
            const tempFileUrl = await this.getPreviewFileUrl()
            const previewType = previewService?.type || this.previewType
            const previewServerUrl = previewService?.url || this.previewServerUrl
            const url = `${this.isPreviewFileAddPathname ? this.allOrigin + location.pathname : this.allOrigin}/#/module/components/page/office?previewUrl=${encodeURIComponent(tempFileUrl)}&fileName=${encodeURIComponent(this.currentFile.fileName)}&previewType=${encodeURIComponent(previewType)}&previewServerUrl=${encodeURIComponent(previewServerUrl)}`
            this.realViewPage = window.open(url)
            this.realViewPage && this.realViewPage.history.go(0)
        },
        // 自定义服务支持下载地址参数及 ${fileUrl} 占位符。
        async openCustomPreviewUrl(previewService) {
            const previewUrl = await this.getPreviewFileUrl()
            const customBaseUrl = previewService.url.indexOf('?') !== -1 ? `${previewService.url}&` : `${previewService.url}?`
            const customUrl = `${customBaseUrl}fileId=${this.currentFile.fileId}&downloadUrl=${encodeURIComponent(previewUrl)}`.replace('${fileUrl}', previewUrl)
            window.open(customUrl)
        },
        getSrc(attachment) {
            return Util.getFileIcon(attachment.fileType);
        },
        isPreviewType(fileName) {
            return !!this.previewServices.length || this.customPreviewUrlStr || Util.isPreviewSupported(fileName, this.officeServerUrl ? OFFICE_FILE_LIST : []);
        },
        setFileType(name) {
            const nameList = name.split('.')
            const endName = (nameList[nameList.length - 1] + '').toLowerCase()
            console.log(endName)
            console.log(this.previewUrl)
            if (endName === 'docx') {
                this.currentFileType = 'VueOfficeDocx'
                this.isActive = true
            } else if (endName === 'xlsx' || endName === 'xls') {
                this.currentFileType = 'VueOfficeExcel'
                this.isActive = true
            } else if (endName === 'pdf') {
                this.currentFileType = 'VueOfficePdf'
                this.isActive = true
            } else if (['jpg', 'png', 'jpeg'].indexOf(endName) !== -1) {
                this.currentFileType = 'ElImage'
                this.isActive = true
            } else if (endName === 'txt') {
                this.currentFileType = 'textPreview'
                this.isActive = true
            } else {
                this.currentFileType = 'svg'
                this.isActive = true
            }
        },
        uploadFile(options){
            if(this.isOss){
                this.uploadOssFile(options)
            }else{
                this.uploadNormalFile(options)
            }
        },
        async uploadNormalFile(options){
            const { file: rawFile, onSuccess, onError } = { onSuccess: () => {}, onError: () => {}, ...options }
            console.log(options)
            const fileName = rawFile.name;
            const lastDotIndex = fileName.lastIndexOf('.');

            let ext = lastDotIndex !== -1 
            ? fileName.substring(lastDotIndex + 1).toLowerCase() 
            : '';
            if(this.accept && this.accept.indexOf('image/*') !== -1 && rawFile.type.indexOf('image/') > -1) {
                ext = 'image/*'
            }
            if(rawFile.type.indexOf('audio/') > -1) {
                ext = 'audio/*'
            }
            if(rawFile.type.indexOf('video/') > -1) {
                ext = 'video/*'
            }
            if (this.accept && this.accept.search(ext) === -1) {
                this.$message.warning('上传类型不正确')
                onError(new Error('上传类型不正确'))
                return
            }

            let params=new FormData()
            params.append('attachments', rawFile)
            Object.keys(this.beforeUploadParams).forEach(key => {
                params.append(key, this.beforeUploadParams[key])
            })
            if(this.uploadBizType) {
                params.append('uploadBizType', this.uploadBizType)
            }
            this.progressPercent = 0
            this.showProgress = true
            const progressEvent = (progressEvent) => {
                this.progressPercent = Number(
                    ((progressEvent.loaded / progressEvent.total) * 100).toFixed(2)
                );
            }
            let url = this.apiBase + '/api/lowcode/models/attachments/actions/upload'
            this.uploadNormalFileApi(this.$attrs.action || url, params, progressEvent).then(async (resp) => {
                if (!resp.error && resp.data) {
                    this.importStatus = 'success'
                    resp.data.forEach(item => {
                        this.valueObject.push(item)
                    })
                    this.fileList = []
                    if (this.listType === 'table') {
                        this.initSortable()
                    }
                    this.success(resp.data, options, this.valueObject)
                    onSuccess(resp.data)
                } else {
                    onError(new Error('上传失败'))
                }
                setTimeout(() => {
                    this.showProgress = false
                }, 1000)
            }).catch(e => {
                this.importStatus = 'exception'
                this.error(e, options, this.fileList)
                onError(e)
                setTimeout(() => {
                    this.showProgress = false
                }, 1000)
            })
        },
        pasteFile (e) {
            // alert(11)
            if (this.visible) {
                let clipboardData = e.clipboardData; // IE
                if (!clipboardData) {
                    //chrome
                    clipboardData = e.originalEvent.clipboardData;
                }
                let items='';
                items = (e.clipboardData || window.clipboardData).items;
                let file = null;
                if (!items || items.length === 0) {
                    this.$message.error('当前浏览器不支持本地或请打开图片再复制');
                    return;
                }

                let fileArr = []
                // 搜索剪切板items
                for (let i = 0; i < items.length; i++) {
                    // if (items[i].type.indexOf('image') !== -1) {//此行代码注释掉，可以上传所有类型的文件
                    file = items[i].getAsFile();
                    file && fileArr.push(file)
                    // break;
                    // }
                }
                if (this.multiple) {
                    if(this.$attrs.limit && (fileArr.length + this.valueObject.length > this.$attrs.limit)) {
                        this.exceed(fileArr, this.valueObject)
                        return
                    }
                    for(const i of fileArr) {
                        let fileData={}
                        fileData.file = i
                        if(i){// 对复制黏贴的类型进行判断，若是非文件类型，比如复制黏贴的文字，则不会调用上传文件的函数
                            this.beforeAvatarUpload(i).then(()=>{
                                this.uploadFile(fileData);//再次调用上传文件的函数
                            }).catch((err)=>{
                                
                            })
                            
                        }
                    }
                    fileArr = []
                } else {
                    console.log('single', file)
                    let fileData={};
                    fileData.file=file;
                    if(file){//对复制黏贴的类型进行判断，若是非文件类型，比如复制黏贴的文字，则不会调用上传文件的函数
                     this.beforeAvatarUpload(file).then(()=>{
                                this.uploadFile(fileData);//再次调用上传文件的函数
                            }).catch((err)=>{
                                
                            })
                        
                    }
                }
            }
        },
        removeAttachment(attachment) {
            if(attachment && attachment.percentage === 0 && attachment.status === 'ready') {
                return
            }
            this.$confirm('是否确定删除文件?', '提示', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                let curFileId = attachment.fileId;
                const index = this.valueObject.findIndex((a) => a.fileId === curFileId)
                if (index !== -1) {
                    const removeFileApiObj = this.valueObject.splice(index, 1)
                    this.removeAct(removeFileApiObj[0].fileId)
                    this.$emit("update:modelValue", this.valueObject.map(i => i.fileId).join(','))
                    this.$emit('update:entityModel', this.multiple ? this.valueObject : this.valueObject[0])
                }
                curFileId = null;
                this.$message({
                    type: 'success',
                    message: '删除成功!'
                });
            }).catch(() => {
            });
        },
        // 移除附件接口
        async removeAct(fileId) {
            if(!this.$attrs.removeAction) {
                await this.removeFileApi(fileId)
                return
            }
            const url = this.$attrs.removeAction && this.$attrs.removeAction(fileId)
            this.customRemoveApi(url).then(resp => {
                console.log('------------------------------------------------------ removeAct resp', resp)
                if (!resp.error && resp.data) {
                    this.importStatus = 'success'
                    this.$message({
                        type: 'success',
                        message: '移除成功!'
                    });
                } else {
                    this.importStatus = 'exception'
                    this.$message.error('移除失败');
                }
            }).catch(e => {
                this.importStatus = 'exception'
                this.$message.error('移除失败');
            })
        },
        shortFileName(name) {
            if (name.length >= 18) {
                return (
                    name.substring(0, 8) +
                    "..." +
                    name.substring(name.length - 7, name.length)
                );
            } else {
                return name;
            }
        },
        exceed(files, fileList) {
            this.$message.warning(`当前限制选择 ${this.$attrs.limit} 个文件`);
        },
        error(err, file, fileList) {
            this.$emit('uploadError',{err, file, fileList})
        },
        success(response, file, fileList) {
            console.log(...this.valueObject)
            console.log(this.entityModel)
            console.log(response, 'ssss')
            if (response !== undefined) {
                let data = []
                if (this.multiple) {
                    console.log([{
                        fileId: response[0].fileId,
                        ...response[0]
                    }])
                    data = [
                        ...this.valueObject,
                    ]
                } else {
                    data = [{
                        fileId: response[0].fileId,
                        ...response[0]
                    }]
                }
                const ids = data.map(i => i.fileId).join(',')
                this.$emit("update:modelValue", ids)
                this.$emit('update:entityModel', data.length === 1 ? data[0] : data)
                this.$emit('uploadSuccess',{response, file, fileList})
                if (!this.multiple) {
                    this.visible = false
                }
            }

        },
        change(file, fileList) {
            // console.log(fileList);
        },
        async beforeAvatarUpload(file) {
            const isAllow = await this.getFileIsAllowUpload(file)
            if(!isAllow) {
                return Promise.reject()
            }
            if(typeof isAllow === 'object' && isAllow !== null) {
                this.beforeUploadParams = isAllow
            }   
            
            if(this.isLimitImgWidthHeight) {
                const ext = await  this.getImageInfo(file)
                let flag = true
                const limitImgWidth = this.limitImgWidth
                const limitImgHeight = this.limitImgHeight
                const { width, height } = ext || {}
                if(width == limitImgWidth && height == limitImgHeight) {
                    flag = true
                } else {
                    this.$message.warning(`上传图片宽度必须是${limitImgWidth}px,高度必须是${limitImgHeight}px!`);
                    flag = false
                }
                if(flag) {
                    return Promise.resolve(flag)
                } else {
                    return Promise.reject()
                }
            } else {
                if(!this.fileSize || isNaN(Number(this.fileSize))) {
                    return Promise.resolve(true)
                }
                const isLtSize = (this.sizeUnit === 'KB' ? file.size / 1024 :  this.sizeUnit === 'MB' ? file.size / 1024 / 1024 : file.size / 1024 / 1024 / 1024) < this.fileSize
                if (!isLtSize) {
                    this.$message.warning(`上传附件不能超过 ${this.fileSize}${this.sizeUnit}!`);
                    return Promise.reject()
                }
                return isLtSize
            }
        },
        generateSize(file) {
            let result = file.fileSize / 1024
            if(result < 1000) return `${result.toFixed(2)} KB`
            result = result / 1024
            if(result < 1000) return `${result.toFixed(2)} MB`
            result = result / 1024
            return `${result.toFixed(2)} GB`
        },
        async downloadOssFile(filename) {
      const url = await this.getDownloadOssFileUrl(filename)
      const a = document.createElement("a")
      a.download = filename
      a.href = url
      document.body.appendChild(a)
      a.click()
      a.remove()
    },

    async getOssClient() {
      const res = await this.getOssSTSTokenApi()
      const { default: OSS } = await import('ali-oss')
      const newClient = new OSS({
        accessKeyId: res.assumeRoleResponse.credentials.accessKeyId,
        accessKeySecret: res.assumeRoleResponse.credentials.accessKeySecret,
        stsToken: res.assumeRoleResponse.credentials.securityToken,
        region: `oss-${res.regionId}`,
        endpoint: res.endpoint,
        bucket: res.bucketName,
        expiration: res.assumeRoleResponse.credentials.expiration,
      })
      this.expirationTime = res.assumeRoleResponse.credentials.expiration
      return newClient
    },
    isCredentialsExpired() {
      const expireDate = new Date(this.expirationTime)
      const now = new Date()
      // 如果有效期不足一分钟，视为过期。
      console.log(expireDate.getTime(), now.getTime(), "time---")
      return expireDate.getTime() - now.getTime() <= 60000
    },
    async uploadOssFile(options) {
      const { file: rawFile, onSuccess, onError } = { onSuccess: () => {}, onError: () => {}, ...options }
      let ext = rawFile.name.substring(rawFile.name.lastIndexOf(".") + 1)
      if (this.accept === "image/*" && rawFile.type.indexOf("image/") > -1) {
        ext = "image/*"
      }
      if (rawFile.type.indexOf("audio/") > -1) {
        ext = "audio/*"
      }
      if (rawFile.type.indexOf("video/") > -1) {
        ext = "video/*"
      }
      if (this.accept && this.accept.search(ext) === -1) {
        this.$message.warning("上传类型不正确")
        onError(new Error("上传类型不正确"))
        return
      }
      this.progressPercent = 0
      this.showProgress = true
      if (this.isCredentialsExpired()) {
        this.newClient = await this.getOssClient()
      }
      this.newClient
        .multipartUpload(`${this.filePath}${rawFile.name}`, rawFile,
        {
          progress: (p) => {
            this.progressPercent = Math.floor(p * 100);
          },
          partSize: 102400 
        })
        .then(async (resp) => {
          if (resp.res.status == 200) {
            this.progressPercent = 100
            const ossFileObj = {
              appName: this.getAppCode(),
              attachmentGroup: null,
              extendObj: null,
              fileMd5: null,
              fileName: resp.name,
              fileUrl: resp.url,
              fileType: rawFile.type,
              fileSize: rawFile.size,
              storeType: null,
              targetType: "lowcode-model",
              targetId: "default",
            }
            const data = await this.addOssFileApi(ossFileObj)
            if (data) {
              this.importStatus = "success"
              this.valueObject.push(data)
              this.fileList = []
              if (this.listType === "table") {
                this.initSortable()
              }
              this.success([data], options, this.valueObject)
              onSuccess(data)
            } else {
              onError(new Error("上传失败"))
            }
          } else {
            onError(new Error("上传失败"))
          }
          setTimeout(() => {
            this.showProgress = false
          }, 1000)
        }).catch(e => {
          onError(e)
          setTimeout(() => {
            this.showProgress = false
          }, 1000)
        })
    },
    },
};
</script>

<style lang="scss">
.collapse-upload-box {
    .el-upload-list__item {
        .el-col {
            height: 28px !important;
        }
        .ellipsis {
            white-space: nowrap !important;
        }
    }
}
.docx{
    padding: 50px !important;
}
.mask {
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    position: fixed;
    top: 0;
    left: 0;
    z-index: 9998;
}
.preview-dialog {
    width: 840px;
    height: 520px;
    overflow: hidden;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 8px;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 9999;
    opacity: 0;
    display: flex;
    flex-direction: column;

    &.full-screen {
        width: 100%;
        height: 100%;

        .vue-office-pdf {
            height: 100% !important;
        }
        .x-spreadsheet-table {
            width: 100% !important;
            height: 100% !important;
        }
    }

    &.active {
        opacity: 1;
    }

    .header {
        height: 30px;
        line-height: 30px;
        background: #fff;
        padding: 0 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 16px;
        cursor: pointer;

        .operation-btns {
            display: flex;
            align-items: center;

            .full-screen-btn {
                width: 12px;
                height: 10px;
                border-radius: 3px;
                border: 1px solid #333;
                margin-right: 10px;
            }
        }
    }

    .content {
        padding: 0 10px;
        flex: 1;
        overflow: auto;
    }
}

.popper-class {
    max-height: 300px !important;
    overflow: auto;
}
.custom-popover {
    z-index: 4999 !important;
}
.el-upload-list__item {
    i {
        font-size: 12px;
    }
    & .show-close, & .close {
        font-size: 14px;
        top: 50%;
        transform: translateY(-50%);
    }
}
.notButton .el-upload-dragger {
    display: flex !important;
    align-items: center;
    justify-content: center;
    height: 140px !important;
    width: 440px;
}

.notButton .el-upload {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 100%;
}

.notButton .upload-drag-area {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
}

.notButton .upload-icon {
    font-size: 36px !important;
    color: #c0c4cc !important;
}

.notButton .el-upload__text {
    line-height: 1.5;
    font-size: 13px;
    color: #909399;
}

.notButton .el-upload__tip {
    margin-top: 4px;
    line-height: 1.4;
    text-align: center;
}

.error {
    color: #bd5050;
}

.thumbnail-popover, .thumbnail {
    position: relative;
    height: 80px;
    display: inline-block;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.3s ease;
    text-align: center;
    background: #f2f6fc;

    .close {
        position: absolute;
        top: -9px;
        right: -9px;
        width: 18px;
        height: 18px;
        line-height: 18px;
        border-radius: 100%;
        background: #bd5050;
        color: #ffffff;
        text-align: center;
        opacity: 0;
        transition: all 0.3s ease;
        z-index: 1000;
    }

    &:hover {
        .close {
            opacity: 1;
            transform: rotate(-90deg);
        }

        background: #ebeef5;
    }
    .thumbnail-popover {
        height: 60px;
    }
    .attachment-img {
        height: inherit;
        width: 120px;

        &:hover {
            outline: 2px dotted gray;
        }
    }

    .attachment-other {
        height: inherit;
        min-width: 120px;
        width: 100%;
        position: relative;
        display: inline-block;
        .body {
            line-height: 70px;
            font-size: 40px;
            color: gray;
            opacity: 0.5;
            text-align: center;
        }

        .footer {
            background: #080808;
            color: #fff;
            position: absolute;
            font-size: 12px;
            width: 100%;
            height: 16px;
            line-height: 16px;
            bottom: 0px;
            opacity: 0.6;
            transition: all 0.3s ease;
            .download {
                position: absolute;
                bottom: 0px;
                right: 5px;
                cursor: pointer;
                color: #ffffff !important;
            }
            .edit {
                position: absolute;
                bottom: 0px;
                right: 20px;
                cursor: pointer;
                color: #ffffff !important;
            }

            .view {
                position: absolute;
                bottom: 0px;
                left: 5px;
                cursor: pointer;
                color: #ffffff;
            }
        }

        &:hover {
            .footer {
                opacity: 1;
            }
        }
    }

    .file-xls,
    .file-xlsx {
        background: rgb(16, 124, 45) !important;
    }

    .file-doc,
    .file-docx {
        background: rgb(0, 168, 238) !important;
    }

    .file-html {
        background: rgb(221, 81, 69) !important;
    }
}

.file-name {
    margin-top: 10px;
    line-height: 0px;
}

a.table_download, a.list_download {
    cursor: pointer;
    color: #409EFF;
    line-height: 28px;
    padding-right: 15px;
    text-decoration: none;
}
a.table_download:link, a.table_download:visited, a.table_download:active, a.table_download:hover {
    color: #409EFF;
}
.previewAble {
    color: #409EFF;
    cursor: pointer;
}
a.list_download:link, a.list_download:visited, a.list_download:active, a.list_download:hover {
    color: #606266
}
.show-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.el-upload-list__item .action {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 2px;
    height: 28px;
}
.mode-edit-list .el-upload-list__item .action {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 50px;
}

.pm-upload {
    width: calc(100% - 2px);
    .hidden {
        visibility: hidden;
    }

    .children-upload-wrap {
        position: relative;
        padding-right: 0;

        &.has-children-download {
            padding-right: 68px;
        }

        .children-download-all-btn {
            position: absolute;
            top: 50%;
            right: 0;
            transform: translateY(-50%);
            display: inline-flex;
            align-items: center;
            padding: 0;
            opacity: 0;
            pointer-events: none;
            transition: opacity .2s ease;

            i {
                margin-right: 4px;
            }
        }

        &:hover {
            .children-download-all-btn {
                opacity: 1;
                pointer-events: auto;
            }
        }
    }

    .upload-action-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 6px;

        &.inside-approval-opinion {
            justify-content: flex-start;
        }
    }

    .download-all-btn {
        display: inline-flex;
        align-items: center;
        padding: 0;
        margin-left: auto;

        i {
            margin-right: 4px;
        }
    }
}
.mode-edit {
    & > span {
        position: absolute;
        right: 10px;
        bottom: 10px;
    }
    & > .mode-edit-list {
        display: flex;
        align-items: center;
        flex-wrap: wrap;

        .el-upload-list__item {
            width: 360px;
            height: 50px;
            margin: 0 0 5px 5px;
            border-radius: 4px;
            // background-color: #f5f6fb;
            background-color: #f2f3f8;

            .attachment-col {
                height: 50px !important;
                line-height: 50px !important;
                display: flex;

                .svgicon {
                    display: inline-block;
                    width: 32px;
                    height: 32px;
                    margin-left: 10px;
                }

                .attachment-card {
                    display: flex;
                    width: calc(100% - 52px);
                    height: 50px;
                    padding: 8px 0;
                    margin-left: 10px;
                    & > div {
                        width: 100%;
                        height: 20px;
                        line-height: 20px;
                    }
                }
            }
        }
    }
    & > div > .mode-edit-list {
        display: flex;
        align-items: center;
        flex-wrap: wrap;

        .el-upload-list__item {
            width: 360px;
            height: 50px;
            margin: 0 0 5px 5px;
            border-radius: 4px;
            // background-color: #f5f6fb;
            background-color: #f2f3f8;

            .attachment-col {
                height: 50px !important;
                line-height: 50px !important;
                display: flex;

                .svgicon {
                    display: inline-block;
                    width: 32px;
                    height: 32px;
                    margin-left: 10px;
                }

                .attachment-card {
                    display: flex;
                    align-items: center;
                    width: calc(100% - 52px);
                    height: 50px;
                    padding: 8px 0;
                    margin-left: 10px;
                    & > div {
                        width: 100%;
                        height: 20px;
                        line-height: 20px;
                    }
                }
            }
        }
    }
    .btn-edit {
        width: 24px;
        height: 24px;
        & > img {
            display: inline-block;
            width: 100%;
            height: 100%;
            fill: #AAAAAA;
        }
    }
}
.pm-upload .el-table thead th.el-table__cell {
    background-color: #f8f8f9;
}
.svgicon {
    padding-left: 0px !important;
    height: 12px;
    //margin-left: 10px;
}
.one_row {
    width: 100%;
    flex: 1;
    display: inline-block;
    overflow-x: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}
.dis_block {
    display: block;
}
.el-button .el-icon {
    font-size: 16px;
}
.el-upload-list__item.is-success.el-row {
    margin-top: 3px;
}
.slide-fade-enter-active {
    transition: all .3s ease;
}
.slide-fade-leave-active {
    transition: all .8s cubic-bezier(1.0, 0.5, 0.8, 1.0);
}
.slide-fade-enter, .slide-fade-leave-to
    /* .slide-fade-leave-active for below version 2.1.8 */ {
    transform: translateX(10px);
    opacity: 0;
}
.ellipsis {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
</style>
<!-- Modified by AI on 2026-10-29 17:04:34 -->
