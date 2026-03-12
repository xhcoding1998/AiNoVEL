<script setup>
import { ref, onMounted, watch, inject } from 'vue'
import { useRoute } from 'vue-router'
import { useNovelStore } from '../../stores/novel'
import { useToast } from '../../composables/useToast'
import { useAIRegenerate } from '../../composables/useAIRegenerate'
import { useCascadeRegenerate } from '../../composables/useCascadeRegenerate'
import { aiApi } from '../../api/ai'
import VTextarea from '../ui/VTextarea.vue'
import VButton from '../ui/VButton.vue'
import VCard from '../ui/VCard.vue'
import VTabs from '../ui/VTabs.vue'
import VInput from '../ui/VInput.vue'
import VSelect from '../ui/VSelect.vue'
import VModal from '../ui/VModal.vue'
import VBadge from '../ui/VBadge.vue'
import VAccordionItem from '../ui/VAccordionItem.vue'
import VConfirmModal from '../ui/VConfirmModal.vue'

const route = useRoute()
const store = useNovelStore()
const toast = useToast()
const pid = route.params.id
const dataVersion = inject('dataVersion', ref(0))
const isGenerating = inject('isParentGenerating', ref(false))
watch(dataVersion, () => loadAll())

const regenPlot = useAIRegenerate()
const regenVol = useAIRegenerate()
const {
  showCascadeModal, cascadeAffectedSteps, cascadeStepLabel,
  cascadeLoading, promptCascade, confirmCascade, cancelCascade
} = useCascadeRegenerate()

const activeTab = ref('storyline')
const saving = ref(false)
const aiGenerating = ref(false)

const plotForm = ref({ main_storyline: '', outline_summary: '' })
const openPlotSections = ref({ main_storyline: false, outline_summary: false })
const showVolumeModal = ref(false)
const volumeForm = ref({ id: null, volume_number: 1, title: '', goal: '', summary: '' })
const showDeviceModal = ref(false)
const deviceForm = ref({ id: null, device_type: 'foreshadowing', description: '', setup_chapter: null, payoff_chapter: null, status: 'planted' })

const deviceTypes = [{ label: '伏笔', value: 'foreshadowing' }, { label: '反转', value: 'reversal' }, { label: '信息差', value: 'info_gap' }]
const deviceStatuses = [{ label: '已埋设', value: 'planted' }, { label: '发展中', value: 'growing' }, { label: '已回收', value: 'resolved' }]
const deviceTypeLabel = { foreshadowing: '伏笔', reversal: '反转', info_gap: '信息差' }
const aiDeviceGenerating = ref(false)

async function loadPlot() {
  await store.fetchPlotControl(pid)
  if (store.plotControl) {
    plotForm.value.main_storyline = store.plotControl.main_storyline || ''
    plotForm.value.outline_summary = store.plotControl.outline_summary || ''
  }
}

async function loadVolumes() {
  await store.fetchVolumes(pid)
}

async function loadAll() {
  await Promise.all([loadPlot(), loadVolumes(), store.fetchPlotDevices(pid)])
}

onMounted(loadAll)

async function savePlot() {
  saving.value = true
  try {
    await store.savePlotControl(pid, plotForm.value)
    toast.success('已保存')
    promptCascade(pid, 'plot_control', loadAll)
  } catch { toast.error('保存失败') }
  finally { saving.value = false }
}

async function saveVolume() {
  saving.value = true
  try {
    await store.saveVolume(pid, volumeForm.value)
    toast.success('已保存')
    showVolumeModal.value = false
    promptCascade(pid, 'volumes', loadAll)
  } catch { toast.error('保存失败') }
  finally { saving.value = false }
}

async function saveDevice() {
  saving.value = true
  try { await store.savePlotDevice(pid, deviceForm.value); toast.success('已保存'); showDeviceModal.value = false }
  catch { toast.error('保存失败') }
  finally { saving.value = false }
}

function openAddVolume() {
  volumeForm.value = { id: null, volume_number: (store.volumes.length || 0) + 1, title: '', goal: '', summary: '' }
  showVolumeModal.value = true
}

function openAddDevice() {
  deviceForm.value = { id: null, device_type: 'foreshadowing', description: '', setup_chapter: null, payoff_chapter: null, status: 'planted' }
  showDeviceModal.value = true
}

function handlePlotRegenClick() {
  regenPlot.requestRegenerate(pid, 'plot_control', loadPlot)
}

function handleVolRegenClick() {
  regenVol.requestRegenerate(pid, 'volumes', loadVolumes)
}

async function aiGenerateVolume() {
  aiGenerating.value = true
  try {
    const hint = `请生成第${volumeForm.value.volume_number}卷的大纲`
    const res = await aiApi.generateSingleItem(pid, 'volume', hint)
    const data = res.data || res
    volumeForm.value.volume_number = data.volume_number || volumeForm.value.volume_number
    volumeForm.value.title = data.title || ''
    volumeForm.value.goal = data.goal || ''
    volumeForm.value.summary = data.summary || ''
    toast.success('AI 已生成卷大纲，请检查后保存')
  } catch (err) {
    toast.error(err?.error || 'AI 生成失败')
  } finally {
    aiGenerating.value = false
  }
}

async function aiGenerateDevice() {
  aiDeviceGenerating.value = true
  try {
    const hint = `请生成一个${deviceTypeLabel[deviceForm.value.device_type] || '伏笔'}类型的叙事装置`
    const res = await aiApi.generateSingleItem(pid, 'plot_device', hint)
    const data = res.data || res
    deviceForm.value.device_type = data.device_type || deviceForm.value.device_type
    deviceForm.value.description = data.description || ''
    deviceForm.value.setup_chapter = data.setup_chapter || null
    deviceForm.value.payoff_chapter = data.payoff_chapter || null
    deviceForm.value.status = data.status || 'planted'
    toast.success('AI 已生成内容，请检查后保存')
  } catch (err) {
    toast.error(err?.error || 'AI 生成失败')
  } finally {
    aiDeviceGenerating.value = false
  }
}

const tabs = [{ label: '故事主线', value: 'storyline' }, { label: '分卷大纲', value: 'volumes' }, { label: '伏笔/反转', value: 'devices' }]
</script>

<template>
  <div>
    <VTabs :tabs="tabs" v-model="activeTab" />
    <div class="tab-content">
      <template v-if="activeTab === 'storyline'">
        <VCard>
          <template #header>
            <div class="editor-header">
              <div class="editor-header__left">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3">
                  <path d="M2 3h12M2 8h8M2 13h10" stroke-linecap="round"/>
                </svg>
                <span>故事主线</span>
              </div>
              <VButton variant="ghost" size="sm" @click="regenPlot.showRegenInput.value = !regenPlot.showRegenInput.value" :loading="regenPlot.regenerating.value" :disabled="isGenerating">
                AI 重新生成
              </VButton>
            </div>
          </template>
          <div v-if="regenPlot.showRegenInput.value" class="regen-bar">
            <VInput v-model="regenPlot.regenPrompt.value" placeholder="补充指令（可选）..." />
            <VButton variant="primary" size="sm" :loading="regenPlot.regenerating.value" :disabled="isGenerating" @click="handlePlotRegenClick">生成</VButton>
          </div>
          <div class="accordion-list">
            <VAccordionItem title="故事主线" :open="openPlotSections.main_storyline" @toggle="openPlotSections.main_storyline = !openPlotSections.main_storyline">
              <VTextarea v-model="plotForm.main_storyline" placeholder="描述整个故事的主线走向" :rows="5" />
            </VAccordionItem>
            <VAccordionItem title="大纲摘要" :open="openPlotSections.outline_summary" @toggle="openPlotSections.outline_summary = !openPlotSections.outline_summary">
              <VTextarea v-model="plotForm.outline_summary" placeholder="整体大纲的简要概述" :rows="5" />
            </VAccordionItem>
          </div>
          <template #footer>
            <VButton variant="primary" :loading="saving" :disabled="isGenerating" @click="savePlot">保存</VButton>
          </template>
        </VCard>
      </template>

      <template v-if="activeTab === 'volumes'">
        <div class="sub-header">
          <span class="sub-title">分卷大纲</span>
          <div class="flex gap-2">
            <VButton variant="ghost" size="sm" @click="regenVol.showRegenInput.value = !regenVol.showRegenInput.value" :loading="regenVol.regenerating.value" :disabled="isGenerating">
              AI 重新生成
            </VButton>
            <VButton variant="primary" size="sm" @click="openAddVolume">添加卷</VButton>
          </div>
        </div>
        <div v-if="regenVol.showRegenInput.value" class="regen-bar">
          <VInput v-model="regenVol.regenPrompt.value" placeholder="补充指令（可选）..." />
            <VButton variant="primary" size="sm" :loading="regenVol.regenerating.value" :disabled="isGenerating" @click="handleVolRegenClick">生成</VButton>
        </div>
        <div class="vol-list">
          <VCard v-for="vol in store.volumes" :key="vol.id" padding="sm">
            <div class="vol-item">
              <div class="vol-item__head">
                <strong>第{{ vol.volume_number }}卷</strong>
                <span v-if="vol.title" class="vol-item__title">{{ vol.title }}</span>
              </div>
              <p v-if="vol.goal" class="vol-item__goal">目标：{{ vol.goal }}</p>
              <p v-if="vol.summary" class="vol-item__summary">{{ vol.summary }}</p>
            </div>
          </VCard>
        </div>
        <p v-if="!store.volumes.length" class="empty-text">AI 尚未生成分卷</p>
      </template>

      <template v-if="activeTab === 'devices'">
        <div class="sub-header">
          <span class="sub-title">伏笔 / 反转 / 信息差</span>
          <VButton variant="primary" size="sm" @click="openAddDevice">添加</VButton>
        </div>
        <div class="device-list">
          <VCard v-for="d in store.plotDevices" :key="d.id" padding="sm">
            <div class="device-item">
              <div class="device-item__head">
                <VBadge :variant="d.device_type === 'reversal' ? 'danger' : d.device_type === 'info_gap' ? 'warning' : 'info'">{{ d.device_type === 'reversal' ? '反转' : d.device_type === 'info_gap' ? '信息差' : '伏笔' }}</VBadge>
                <VBadge :variant="d.status === 'resolved' ? 'success' : d.status === 'growing' ? 'warning' : 'default'">{{ d.status === 'resolved' ? '已回收' : d.status === 'growing' ? '发展中' : '已埋设' }}</VBadge>
              </div>
              <p class="device-item__desc">{{ d.description }}</p>
            </div>
          </VCard>
        </div>
        <p v-if="!store.plotDevices.length" class="empty-text">暂无记录</p>
      </template>
    </div>

    <VModal v-model="showVolumeModal" title="添加卷">
      <div class="form-grid">
        <VInput v-model.number="volumeForm.volume_number" label="卷号" type="number" />
        <VInput v-model="volumeForm.title" label="标题" placeholder="卷标题" />
        <VTextarea v-model="volumeForm.goal" label="本卷目标" :rows="2" />
        <VTextarea v-model="volumeForm.summary" label="内容概要" :rows="3" />
      </div>
      <template #footer>
        <div class="modal-footer-full">
          <VButton variant="ghost" size="sm" :loading="aiGenerating" @click="aiGenerateVolume" class="ai-fill-btn">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" style="flex-shrink:0">
              <path d="M7 1v3M7 10v3M1 7h3M10 7h3M2.8 2.8l2.1 2.1M9.1 9.1l2.1 2.1M11.2 2.8l-2.1 2.1M4.9 9.1l-2.1 2.1" stroke-linecap="round"/>
            </svg>
            AI 智能填充
          </VButton>
          <div class="modal-footer-right">
            <VButton variant="secondary" @click="showVolumeModal = false">取消</VButton>
            <VButton variant="primary" :loading="saving" :disabled="isGenerating" @click="saveVolume">保存</VButton>
          </div>
        </div>
      </template>
    </VModal>

    <VModal v-model="showDeviceModal" title="添加伏笔/反转">
      <div class="form-grid">
        <VSelect v-model="deviceForm.device_type" label="类型" :options="deviceTypes" />
        <VTextarea v-model="deviceForm.description" label="描述" placeholder="伏笔/反转/信息差的具体内容..." :rows="4" />
        <div class="form-row">
          <VInput v-model.number="deviceForm.setup_chapter" label="埋设章节" type="number" />
          <VInput v-model.number="deviceForm.payoff_chapter" label="回收章节" type="number" />
        </div>
        <VSelect v-model="deviceForm.status" label="状态" :options="deviceStatuses" />
      </div>
      <template #footer>
        <div class="modal-footer-full">
          <VButton variant="ghost" size="sm" :loading="aiDeviceGenerating" @click="aiGenerateDevice" class="ai-fill-btn">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" style="flex-shrink:0">
              <path d="M7 1v3M7 10v3M1 7h3M10 7h3M2.8 2.8l2.1 2.1M9.1 9.1l2.1 2.1M11.2 2.8l-2.1 2.1M4.9 9.1l-2.1 2.1" stroke-linecap="round"/>
            </svg>
            AI 智能填充
          </VButton>
          <div class="modal-footer-right">
            <VButton variant="secondary" @click="showDeviceModal = false">取消</VButton>
            <VButton variant="primary" :loading="saving" :disabled="isGenerating" @click="saveDevice">保存</VButton>
          </div>
        </div>
      </template>
    </VModal>

    <VConfirmModal
      v-model="regenPlot.showConfirmModal.value"
      title="确认重新生成剧情总控"
      confirm-text="确认重新生成"
      :affected-steps="regenPlot.affectedSteps.value"
      :loading="regenPlot.regenerating.value"
      @confirm="regenPlot.confirmRegenerate()"
      @cancel="regenPlot.cancelRegenerate()"
    >
      <p>重新生成「剧情总控」将覆盖当前剧情数据，且由于内容链路的依赖关系，此阶段之后的所有内容也可能需要重新生成以保持一致性。</p>
    </VConfirmModal>

    <VConfirmModal
      v-model="regenVol.showConfirmModal.value"
      title="确认重新生成分卷大纲"
      confirm-text="确认重新生成"
      :affected-steps="regenVol.affectedSteps.value"
      :loading="regenVol.regenerating.value"
      @confirm="regenVol.confirmRegenerate()"
      @cancel="regenVol.cancelRegenerate()"
    >
      <p>重新生成「分卷大纲」将覆盖当前所有分卷数据及其下的章节内容，且由于内容链路的依赖关系，此阶段之后的所有内容也可能需要重新生成以保持一致性。</p>
    </VConfirmModal>

    <VConfirmModal
      v-model="showCascadeModal"
      title="是否重新生成后续内容？"
      confirm-text="重新生成后续"
      cancel-text="跳过"
      confirm-variant="primary"
      :affected-steps="cascadeAffectedSteps"
      :loading="cascadeLoading"
      @confirm="confirmCascade"
      @cancel="cancelCascade"
    >
      <p>你修改了「{{ cascadeStepLabel }}」，后续内容依赖此信息。建议重新生成以保持一致性，也可跳过稍后手动处理。</p>
    </VConfirmModal>
  </div>
</template>

<style scoped>
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.editor-header__left {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.editor-header__left svg {
  color: var(--text-tertiary);
}

.tab-content {
  margin-top: 20px;
}

.sub-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.sub-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.regen-bar {
  display: flex;
  gap: var(--space-2);
  margin-bottom: var(--space-5);
  padding-bottom: var(--space-5);
  border-bottom: 1px solid var(--border-default);
}

.regen-bar .v-input { flex: 1; }

.accordion-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.form-grid { display: flex; flex-direction: column; gap: var(--space-4); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.vol-list, .device-list { display: flex; flex-direction: column; gap: var(--space-3); }

.vol-item__head {
  display: flex;
  gap: var(--space-2);
  font-size: 14px;
  margin-bottom: var(--space-2);
  align-items: baseline;
}

.vol-item__title {
  color: var(--text-secondary);
}

.vol-item__goal {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.vol-item__summary {
  font-size: 13px;
  color: var(--text-tertiary);
  margin-top: var(--space-1);
  line-height: 1.5;
}

.device-item__head { display: flex; gap: var(--space-2); margin-bottom: var(--space-2); }
.device-item__desc { font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
.empty-text { color: var(--text-tertiary); text-align: center; padding: var(--space-10); font-size: 14px; }

.modal-footer-full {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.modal-footer-right {
  display: flex;
  gap: var(--space-3);
}

.ai-fill-btn {
  color: var(--accent-blue, #0070f3);
}

.ai-fill-btn:hover:not(:disabled) {
  background: var(--accent-blue-subtle, rgba(0, 112, 243, 0.08));
  color: var(--accent-blue, #0070f3);
}
</style>
