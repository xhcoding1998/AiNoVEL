<script setup>
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useNovelStore } from '../../stores/novel'
import { useToast } from '../../composables/useToast'
import { useAIRegenerate } from '../../composables/useAIRegenerate'
import VTextarea from '../ui/VTextarea.vue'
import VButton from '../ui/VButton.vue'
import VCard from '../ui/VCard.vue'
import VTabs from '../ui/VTabs.vue'
import VInput from '../ui/VInput.vue'
import VSelect from '../ui/VSelect.vue'
import VModal from '../ui/VModal.vue'
import VBadge from '../ui/VBadge.vue'

const route = useRoute()
const store = useNovelStore()
const toast = useToast()
const pid = route.params.id

const regenPlot = useAIRegenerate()
const regenVol = useAIRegenerate()

const activeTab = ref('storyline')
const saving = ref(false)

const plotForm = ref({ main_storyline: '', outline_summary: '' })
const showVolumeModal = ref(false)
const volumeForm = ref({ id: null, volume_number: 1, title: '', goal: '', summary: '' })
const showDeviceModal = ref(false)
const deviceForm = ref({ id: null, device_type: 'foreshadowing', description: '', setup_chapter: null, payoff_chapter: null, status: 'planted' })

const deviceTypes = [{ label: '伏笔', value: 'foreshadowing' }, { label: '反转', value: 'reversal' }, { label: '信息差', value: 'info_gap' }]
const deviceStatuses = [{ label: '已埋设', value: 'planted' }, { label: '发展中', value: 'growing' }, { label: '已回收', value: 'resolved' }]

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
  try { await store.savePlotControl(pid, plotForm.value); toast.success('已保存') }
  catch { toast.error('保存失败') }
  finally { saving.value = false }
}

async function saveVolume() {
  saving.value = true
  try { await store.saveVolume(pid, volumeForm.value); toast.success('已保存'); showVolumeModal.value = false }
  catch { toast.error('保存失败') }
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

const tabs = [{ label: '故事主线', value: 'storyline' }, { label: '分卷大纲', value: 'volumes' }, { label: '伏笔/反转', value: 'devices' }]
</script>

<template>
  <div>
    <VTabs :tabs="tabs" v-model="activeTab" />
    <div style="margin-top: 20px">
      <template v-if="activeTab === 'storyline'">
        <VCard>
          <template #header>
            <div class="editor-header">
              <span>故事主线</span>
              <VButton variant="ghost" size="sm" @click="regenPlot.showRegenInput.value = !regenPlot.showRegenInput.value" :loading="regenPlot.regenerating.value">
                AI 重新生成
              </VButton>
            </div>
          </template>
          <div v-if="regenPlot.showRegenInput.value" class="regen-bar">
            <VInput v-model="regenPlot.regenPrompt.value" placeholder="补充指令（可选）..." />
            <VButton variant="primary" size="sm" :loading="regenPlot.regenerating.value" @click="regenPlot.regenerateSection(pid, 'plot_control', loadPlot)">生成</VButton>
          </div>
          <div class="form-grid">
            <VTextarea v-model="plotForm.main_storyline" label="故事主线" placeholder="描述整个故事的主线走向" :rows="5" />
            <VTextarea v-model="plotForm.outline_summary" label="大纲摘要" placeholder="整体大纲的简要概述" :rows="5" />
          </div>
          <template #footer>
            <VButton variant="primary" :loading="saving" @click="savePlot">保存</VButton>
          </template>
        </VCard>
      </template>

      <template v-if="activeTab === 'volumes'">
        <div class="flex justify-between items-center" style="margin-bottom:16px">
          <span class="section-title" style="margin:0">分卷大纲</span>
          <div class="flex gap-2">
            <VButton variant="ghost" size="sm" @click="regenVol.showRegenInput.value = !regenVol.showRegenInput.value" :loading="regenVol.regenerating.value">
              AI 重新生成
            </VButton>
            <VButton variant="primary" size="sm" @click="openAddVolume">添加卷</VButton>
          </div>
        </div>
        <div v-if="regenVol.showRegenInput.value" class="regen-bar">
          <VInput v-model="regenVol.regenPrompt.value" placeholder="补充指令（可选）..." />
          <VButton variant="primary" size="sm" :loading="regenVol.regenerating.value" @click="regenVol.regenerateSection(pid, 'volumes', loadVolumes)">生成</VButton>
        </div>
        <div class="vol-list">
          <VCard v-for="vol in store.volumes" :key="vol.id" padding="sm">
            <div class="vol-item">
              <div class="vol-item__head"><strong>第{{ vol.volume_number }}卷</strong><span v-if="vol.title">{{ vol.title }}</span></div>
              <p v-if="vol.goal" class="vol-item__goal">目标：{{ vol.goal }}</p>
              <p v-if="vol.summary" class="vol-item__summary">{{ vol.summary }}</p>
            </div>
          </VCard>
        </div>
        <p v-if="!store.volumes.length" class="empty-text">AI 尚未生成分卷</p>
      </template>

      <template v-if="activeTab === 'devices'">
        <div class="flex justify-between items-center" style="margin-bottom:16px">
          <span class="section-title" style="margin:0">伏笔 / 反转 / 信息差</span>
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
        <VButton variant="secondary" @click="showVolumeModal = false">取消</VButton>
        <VButton variant="primary" :loading="saving" @click="saveVolume">保存</VButton>
      </template>
    </VModal>

    <VModal v-model="showDeviceModal" title="添加伏笔/反转">
      <div class="form-grid">
        <VSelect v-model="deviceForm.device_type" label="类型" :options="deviceTypes" />
        <VTextarea v-model="deviceForm.description" label="描述" :rows="3" />
        <div class="form-row">
          <VInput v-model.number="deviceForm.setup_chapter" label="埋设章节" type="number" />
          <VInput v-model.number="deviceForm.payoff_chapter" label="回收章节" type="number" />
        </div>
        <VSelect v-model="deviceForm.status" label="状态" :options="deviceStatuses" />
      </div>
      <template #footer>
        <VButton variant="secondary" @click="showDeviceModal = false">取消</VButton>
        <VButton variant="primary" :loading="saving" @click="saveDevice">保存</VButton>
      </template>
    </VModal>
  </div>
</template>

<style scoped>
.editor-header { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.regen-bar { display: flex; gap: var(--space-2); margin-bottom: var(--space-4); padding-bottom: var(--space-4); border-bottom: 1px solid var(--border-default); }
.regen-bar .v-input { flex: 1; }
.form-grid { display: flex; flex-direction: column; gap: var(--space-4); }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); }
.vol-list, .device-list { display: flex; flex-direction: column; gap: var(--space-3); }
.vol-item__head { display: flex; gap: var(--space-2); font-size: 14px; margin-bottom: var(--space-2); }
.vol-item__goal { font-size: 13px; color: var(--text-secondary); }
.vol-item__summary { font-size: 13px; color: var(--text-tertiary); margin-top: var(--space-1); }
.device-item__head { display: flex; gap: var(--space-2); margin-bottom: var(--space-2); }
.device-item__desc { font-size: 13px; color: var(--text-secondary); }
.empty-text { color: var(--text-tertiary); text-align: center; padding: var(--space-8); }
</style>
