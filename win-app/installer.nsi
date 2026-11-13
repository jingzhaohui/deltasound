Unicode true
!define APPNAME "DeltaSound"
!define APPVERSION "1.1.0"
Name "${APPNAME} ${APPVERSION}"
OutFile "dist\DeltaSound-Setup-1.1.0.exe"
InstallDir "$LOCALAPPDATA\DeltaSound"
InstallDirRegKey HKCU "Software\DeltaSound" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!include "MUI2.nsh"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\DeltaSound.exe"
!define MUI_FINISHPAGE_RUN_TEXT "立即运行 DeltaSound（装好后请先安装 Equalizer APO）"
!define MUI_FINISHPAGE_TEXT "DeltaSound 已安装。$\r$\n$\r$\n注意：游戏内音效依赖 Equalizer APO，详情见程序面板与安装说明。"
!define MUI_UNCONFIRMPAGE_TEXT_TOP "卸载前建议在 DeltaSound 面板点「恢复原声」，以还原系统音频配置。"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "安装"
  SetOutPath "$INSTDIR"
  File /r "dist-portable\DeltaSound\*.*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  WriteRegStr HKCU "Software\DeltaSound" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeltaSound" "DisplayName" "DeltaSound 1.1.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeltaSound" "DisplayVersion" "${APPVERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeltaSound" "Publisher" "DeltaSound"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeltaSound" "DisplayIcon" "$INSTDIR\DeltaSound.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeltaSound" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeltaSound" "NoModify" 1

  CreateDirectory "$SMPROGRAMS\DeltaSound"
  CreateShortcut "$DESKTOP\DeltaSound.lnk" "$INSTDIR\DeltaSound.exe" "" "$INSTDIR\resources\app\build\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\DeltaSound\DeltaSound.lnk" "$INSTDIR\DeltaSound.exe" "" "$INSTDIR\resources\app\build\icon.ico" 0
  CreateShortcut "$SMPROGRAMS\DeltaSound\卸载 DeltaSound.lnk" "$INSTDIR\Uninstall.exe"
SectionEnd

Section "Uninstall"
  Delete "$DESKTOP\DeltaSound.lnk"
  Delete "$SMPROGRAMS\DeltaSound\DeltaSound.lnk"
  Delete "$SMPROGRAMS\DeltaSound\卸载 DeltaSound.lnk"
  RMDir "$SMPROGRAMS\DeltaSound"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DeltaSound"
  DeleteRegKey HKCU "Software\DeltaSound"
SectionEnd
