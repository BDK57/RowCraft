!include "LogicLib.nsh"
!include "MUI2.nsh"
!include "nsDialogs.nsh"
!include "illustrator-check.nsh"

!ifndef BUILD_UNINSTALLER

Var RowCraftPrerequisiteLabel
Var RowCraftAdobeLink
Var RowCraftRetryButton
Var RowCraftPrerequisiteStatus

Function RowCraftDetectIllustrator
  nsExec::ExecToStack /TIMEOUT=15000 '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -EncodedCommand ${ROWCRAFT_ILLUSTRATOR_CHECK}'
  Pop $RowCraftPrerequisiteStatus
  Pop $0
FunctionEnd

Function RowCraftAdobeSetup
  Pop $0
  ExecShell "open" "https://www.adobe.com/products/illustrator.html"
FunctionEnd

Function RowCraftRetryPrerequisite
  Pop $0
  Call RowCraftUpdatePrerequisite
FunctionEnd

Function RowCraftUpdatePrerequisite
  Call RowCraftDetectIllustrator
  GetDlgItem $1 $HWNDPARENT 1
  ${If} $RowCraftPrerequisiteStatus == 0
    ${NSD_SetText} $RowCraftPrerequisiteLabel "Adobe Illustrator detected. You can continue installing RowCraft. Adobe sign-in and the automation connection will be checked when RowCraft opens."
    EnableWindow $1 1
  ${Else}
    ${NSD_SetText} $RowCraftPrerequisiteLabel "Adobe Illustrator is required. You cannot install RowCraft until Illustrator is installed and registered for automation.$\r$\n$\r$\nInstall or repair Illustrator using Adobe Creative Cloud, then click Check again. A Creative Cloud account and an appropriate Illustrator license are required."
    EnableWindow $1 0
  ${EndIf}
FunctionEnd

Function RowCraftPrerequisitesCreate
  !insertmacro MUI_HEADER_TEXT "Adobe Illustrator requirement" "RowCraft uses your installed Illustrator to produce editable artwork."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 4u 100% 70u "Checking Adobe Illustrator..."
  Pop $RowCraftPrerequisiteLabel
  ${NSD_CreateLink} 0 80u 100% 14u "Open official Adobe Illustrator setup"
  Pop $RowCraftAdobeLink
  ${NSD_OnClick} $RowCraftAdobeLink RowCraftAdobeSetup
  ${NSD_CreateButton} 0 100u 100u 20u "Check again"
  Pop $RowCraftRetryButton
  ${NSD_OnClick} $RowCraftRetryButton RowCraftRetryPrerequisite
  Call RowCraftUpdatePrerequisite
  nsDialogs::Show
FunctionEnd

Function RowCraftPrerequisitesLeave
  Call RowCraftDetectIllustrator
  ${If} $RowCraftPrerequisiteStatus != 0
    MessageBox MB_OK|MB_ICONEXCLAMATION "Install or repair Adobe Illustrator before installing RowCraft."
    Abort
  ${EndIf}
FunctionEnd

!macro customWelcomePage
  !insertmacro MUI_PAGE_WELCOME
  Page custom RowCraftPrerequisitesCreate RowCraftPrerequisitesLeave
!macroend

!macro customInit
  # Silent installations must not bypass the same mandatory prerequisite.
  ${If} ${Silent}
    Call RowCraftDetectIllustrator
    ${If} $RowCraftPrerequisiteStatus != 0
      SetErrorLevel 3
      Quit
    ${EndIf}
  ${EndIf}
!macroend

!endif
