
export const  getConditionByParams = ({node, index, currentPanel, currentParentPanel, settings} = res) => {
  let condition = {}
  if (index === 0) {
    condition = {
      and: settings.condition && settings.condition.and || undefined,
      or: settings.condition && settings.condition.or || undefined,
    }
  } else {
    const propertyName = currentPanel.fk || (currentPanel.config && currentPanel.config.basic && currentPanel.config.basic.parentField)
    const propertyValueStr= node.data[currentParentPanel.pk] + ''
    const arr = propertyValueStr && propertyValueStr.split('__')
    if(arr.length > 1) {
      arr.shift()
    }
    const propertyValue = arr.join('_')
    condition = {
      and: {
        items: [
          {
            propertyName: propertyName,
            op: '=',
            propertyValue: propertyValue,
          },
        ],
      },
    }
  }
  return condition
}