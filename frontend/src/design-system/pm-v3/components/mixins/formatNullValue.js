import { getLowCodePreferenceObject } from '../../utils/util'
export default {
    data() {
        return {}
    },
    computed: {
        formatNullValue(){
            const preferenceObject = getLowCodePreferenceObject(this)
            return preferenceObject?.formConf?.formatNullValue || ''
        }
    }
}
